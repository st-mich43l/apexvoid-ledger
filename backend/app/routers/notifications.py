import asyncio
import json
import time
from datetime import datetime, timezone
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import require_password_changed
from ..database import SessionLocal, get_db
from ..models import User
from ..notification_models import Notification, NotificationDelivery, NotificationPreference

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


def require_same_origin(request: Request) -> None:
  origin = request.headers.get("origin", "")
  try:
    parsed = urlsplit(origin)
    if parsed.scheme not in ("http", "https") or parsed.netloc.lower() != request.headers.get("host", "").lower() or parsed.path not in ("", "/") or parsed.query or parsed.fragment:
      raise ValueError("origin mismatch")
  except ValueError as error:
    raise HTTPException(status_code=403, detail="Same-origin request required") from error


class Preferences(BaseModel):
  model_config = ConfigDict(populate_by_name=True)
  bank_activity: bool = Field(alias="bankActivity", default=True)
  budget_alerts: bool = Field(alias="budgetAlerts", default=True)
  payment_reminders: bool = Field(alias="paymentReminders", default=True)
  monthly_summary: bool = Field(alias="monthlySummary", default=False)
  timezone: str = "UTC"
  quiet_start: int | None = Field(alias="quietStart", default=None, ge=0, le=23)
  quiet_end: int | None = Field(alias="quietEnd", default=None, ge=0, le=23)

  @field_validator("timezone")
  @classmethod
  def validate_timezone(cls, value: str) -> str:
    try:
      ZoneInfo(value)
    except (ZoneInfoNotFoundError, ValueError) as error:
      raise ValueError("Unknown timezone") from error
    return value

  @model_validator(mode="after")
  def validate_quiet_hours(self):
    if (self.quiet_start is None) != (self.quiet_end is None):
      raise ValueError("Both quiet-hour boundaries are required")
    if self.quiet_start is not None and self.quiet_start == self.quiet_end:
      raise ValueError("Quiet-hour boundaries must differ")
    return self


def serialize(item: Notification) -> dict:
  return {"id": item.id, "eventType": item.event_type, "title": item.title, "body": item.body, "destination": item.destination, "createdAt": item.created_at, "readAt": item.read_at}


@router.get("")
def list_notifications(limit: int = Query(30, ge=1, le=100), offset: int = Query(0, ge=0), db: Session = Depends(get_db), user: User = Depends(require_password_changed)):
  rows = db.query(Notification).filter(Notification.user_id == user.id).order_by(Notification.created_at.desc(), Notification.id.desc()).offset(offset).limit(limit).all()
  return [serialize(item) for item in rows]


@router.get("/unread-count")
def unread_count(db: Session = Depends(get_db), user: User = Depends(require_password_changed)):
  count = db.query(func.count(Notification.id)).filter(Notification.user_id == user.id, Notification.read_at.is_(None)).scalar()
  return {"count": count}


def count_unread(user_id: str, session_factory=SessionLocal) -> int:
  # Short-lived session per poll so an open stream never pins a pooled connection.
  with session_factory() as db:
    return db.query(func.count(Notification.id)).filter(Notification.user_id == user_id, Notification.read_at.is_(None)).scalar()


async def count_events(user_id: str, is_disconnected, session_factory=SessionLocal, interval: float = 2.0, heartbeat: float = 15.0, max_seconds: float = 300.0):
  """Yield SSE frames: the unread count on connect and on every change, plus keep-alive pings.

  The stream ends after max_seconds; EventSource reconnects, which re-validates the session.
  """
  last: int | None = None
  started = last_sent = time.monotonic()
  while time.monotonic() - started < max_seconds and not await is_disconnected():
    count = await run_in_threadpool(count_unread, user_id, session_factory)
    now = time.monotonic()
    if count != last:
      last, last_sent = count, now
      yield f"event: count\ndata: {json.dumps({'count': count})}\n\n"
    elif now - last_sent >= heartbeat:
      last_sent = now
      yield ": ping\n\n"
    await asyncio.sleep(interval)


@router.get("/stream")
async def stream_unread_count(request: Request, db: Session = Depends(get_db), user: User = Depends(require_password_changed)):
  user_id = user.id
  db.close()  # release the connection before the long-lived response starts
  return StreamingResponse(count_events(user_id, request.is_disconnected), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.get("/preferences", response_model=Preferences)
def get_preferences(db: Session = Depends(get_db), user: User = Depends(require_password_changed)):
  record = db.get(NotificationPreference, user.id)
  return Preferences.model_validate(record, from_attributes=True) if record else Preferences()


@router.put("/preferences", response_model=Preferences, dependencies=[Depends(require_same_origin)])
def put_preferences(payload: Preferences, db: Session = Depends(get_db), user: User = Depends(require_password_changed)):
  record = db.get(NotificationPreference, user.id)
  if record is None:
    record = NotificationPreference(user_id=user.id)
    db.add(record)
  for key, value in payload.model_dump().items():
    setattr(record, key, value)
  if not payload.bank_activity:
    bank_ids = db.query(Notification.id).filter(Notification.user_id == user.id, Notification.event_type == "bank_activity")
    db.query(NotificationDelivery).filter(NotificationDelivery.notification_id.in_(bank_ids), NotificationDelivery.status == "pending").update({"status": "cancelled", "last_error": "preference_disabled"}, synchronize_session=False)
  db.commit()
  return payload


@router.post("/read-all", status_code=204, dependencies=[Depends(require_same_origin)])
def mark_all_read(db: Session = Depends(get_db), user: User = Depends(require_password_changed)):
  db.query(Notification).filter(Notification.user_id == user.id, Notification.read_at.is_(None)).update({"read_at": datetime.now(timezone.utc)}, synchronize_session=False)
  db.commit()


@router.patch("/{notification_id}/read", dependencies=[Depends(require_same_origin)])
def mark_read(notification_id: str, db: Session = Depends(get_db), user: User = Depends(require_password_changed)):
  item = db.query(Notification).filter(Notification.id == notification_id, Notification.user_id == user.id).first()
  if item is None:
    raise HTTPException(status_code=404, detail="Notification not found")
  if item.read_at is None:
    item.read_at = datetime.now(timezone.utc)
    db.commit()
  return serialize(item)


@router.delete("", status_code=204, dependencies=[Depends(require_same_origin)])
def clear_all(db: Session = Depends(get_db), user: User = Depends(require_password_changed)):
  db.query(Notification).filter(Notification.user_id == user.id).delete(synchronize_session=False)
  db.commit()


@router.delete("/{notification_id}", status_code=204, dependencies=[Depends(require_same_origin)])
def clear_one(notification_id: str, db: Session = Depends(get_db), user: User = Depends(require_password_changed)):
  deleted = db.query(Notification).filter(Notification.id == notification_id, Notification.user_id == user.id).delete(synchronize_session=False)
  if not deleted:
    raise HTTPException(status_code=404, detail="Notification not found")
  db.commit()
