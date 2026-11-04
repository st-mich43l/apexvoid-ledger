import os
import base64
import uuid
from datetime import datetime, timedelta, timezone

from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from ..auth import require_password_changed
from ..database import get_db
from ..models import User
from ..notification_models import Notification, NotificationDelivery, PushSubscription
from ..push_security import encrypt_material, encryption_key, endpoint_hash, validate_endpoint
from .notifications import require_same_origin

router = APIRouter(prefix="/api/push", tags=["push"])


class SubscriptionKeys(BaseModel):
  p256dh: str = Field(min_length=80, max_length=128, pattern=r"^[A-Za-z0-9_-]+={0,2}$")
  auth: str = Field(min_length=20, max_length=32, pattern=r"^[A-Za-z0-9_-]+={0,2}$")

  @field_validator("p256dh", "auth")
  @classmethod
  def validate_key(cls, value: str, info):
    try:
      decoded = base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
      if info.field_name == "p256dh":
        ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), decoded)
      elif len(decoded) != 16:
        raise ValueError("invalid auth length")
    except (ValueError, TypeError) as error:
      raise ValueError("Invalid subscription key") from error
    return value


class SubscriptionInput(BaseModel):
  endpoint: str = Field(min_length=1, max_length=2048)
  keys: SubscriptionKeys
  device_name: str = Field(default="Browser", min_length=1, max_length=120, alias="deviceName")


class TestPushInput(BaseModel):
  subscription_id: str = Field(alias="subscriptionId", min_length=1, max_length=36)


def serialize(record: PushSubscription) -> dict:
  return {"id": record.id, "deviceName": record.device_name, "enabled": record.enabled, "createdAt": record.created_at, "lastSeenAt": record.last_seen_at}


@router.get("/config")
def config(_user: User = Depends(require_password_changed)):
  public_key = os.getenv("VAPID_PUBLIC_KEY", "").strip()
  try:
    encryption_key()
    decoded = base64.urlsafe_b64decode(public_key + "=" * (-len(public_key) % 4))
    ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), decoded)
  except (HTTPException, ValueError, TypeError):
    return {"configured": False, "publicKey": None}
  return {"configured": True, "publicKey": public_key}


@router.get("/subscriptions")
def list_subscriptions(db: Session = Depends(get_db), user: User = Depends(require_password_changed)):
  return [serialize(item) for item in db.query(PushSubscription).filter(PushSubscription.user_id == user.id).order_by(PushSubscription.created_at.desc()).all()]


@router.post("/subscriptions", dependencies=[Depends(require_same_origin)])
def register_subscription(payload: SubscriptionInput, db: Session = Depends(get_db), user: User = Depends(require_password_changed)):
  endpoint = validate_endpoint(payload.endpoint)
  digest = endpoint_hash(endpoint)
  record = db.query(PushSubscription).filter(PushSubscription.endpoint_hash == digest).first()
  if record and record.user_id != user.id:
    raise HTTPException(status_code=409, detail="This device subscription belongs to another account")
  ciphertext = encrypt_material(endpoint, payload.keys.p256dh, payload.keys.auth)
  if record is None:
    record = PushSubscription(user_id=user.id, endpoint_hash=digest, material_ciphertext=ciphertext)
    db.add(record)
  record.material_ciphertext = ciphertext
  record.device_name = payload.device_name.strip() or "Browser"
  record.enabled = True
  record.last_seen_at = datetime.now(timezone.utc)
  db.commit()
  db.refresh(record)
  return serialize(record)


@router.delete("/subscriptions/{subscription_id}", status_code=204, dependencies=[Depends(require_same_origin)])
def delete_subscription(subscription_id: str, db: Session = Depends(get_db), user: User = Depends(require_password_changed)):
  record = db.query(PushSubscription).filter(PushSubscription.id == subscription_id, PushSubscription.user_id == user.id).first()
  if record is None:
    raise HTTPException(status_code=404, detail="Subscription not found")
  record.enabled = False
  db.query(NotificationDelivery).filter(NotificationDelivery.subscription_id == record.id, NotificationDelivery.status == "pending").update({"status": "cancelled", "last_error": "device_disabled"}, synchronize_session=False)
  db.commit()


@router.post("/test", status_code=202, dependencies=[Depends(require_same_origin)])
def test_push(payload: TestPushInput, db: Session = Depends(get_db), user: User = Depends(require_password_changed)):
  # Serialize concurrent requests for this user so the persisted limit is shared by all app instances.
  db.query(User).filter(User.id == user.id).with_for_update().one()
  subscription = db.query(PushSubscription).filter(PushSubscription.id == payload.subscription_id, PushSubscription.user_id == user.id, PushSubscription.enabled.is_(True)).first()
  if subscription is None:
    raise HTTPException(status_code=404, detail="Active subscription not found")
  recent = db.query(Notification.id).filter(Notification.user_id == user.id, Notification.event_type == "test", Notification.created_at >= datetime.now(timezone.utc) - timedelta(minutes=1)).first()
  if recent:
    raise HTTPException(status_code=429, detail="Please wait before sending another test notification")
  notification = Notification(user_id=user.id, event_type="test", event_key=str(uuid.uuid4()), title="ApexVoid Ledger", body="This is a test notification.", destination="/notifications")
  db.add(notification)
  db.flush()
  db.add(NotificationDelivery(notification_id=notification.id, subscription_id=subscription.id))
  db.commit()
  return {"status": "queued", "notificationId": notification.id}
