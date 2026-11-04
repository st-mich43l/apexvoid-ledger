"""User-scoped notification records and the durable delivery outbox."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


def new_id() -> str:
  return str(uuid.uuid4())


def now_utc() -> datetime:
  return datetime.now(timezone.utc)


class PushSubscription(Base):
  __tablename__ = "push_subscriptions"
  id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
  user_id: Mapped[str] = mapped_column(ForeignKey("User.id", ondelete="CASCADE"), nullable=False, index=True)
  endpoint_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
  # Endpoint and client encryption keys are encrypted together; never return them in a listing.
  material_ciphertext: Mapped[str] = mapped_column(String(8192), nullable=False)
  device_name: Mapped[str] = mapped_column(String(120), nullable=False, default="Browser")
  enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
  created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=now_utc)
  updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=now_utc, onupdate=now_utc)
  last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=now_utc)


class Notification(Base):
  __tablename__ = "notifications"
  __table_args__ = (
    UniqueConstraint("user_id", "event_type", "event_key", name="uq_notification_user_event"),
    Index("ix_notification_user_created", "user_id", "created_at"),
  )
  id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
  user_id: Mapped[str] = mapped_column(ForeignKey("User.id", ondelete="CASCADE"), nullable=False)
  event_type: Mapped[str] = mapped_column(String(64), nullable=False)
  event_key: Mapped[str] = mapped_column(String(255), nullable=False)
  title: Mapped[str] = mapped_column(String(160), nullable=False)
  body: Mapped[str] = mapped_column(String(500), nullable=False)
  destination: Mapped[str] = mapped_column(String(512), nullable=False)
  created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=now_utc)
  read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class NotificationPreference(Base):
  __tablename__ = "notification_preferences"
  user_id: Mapped[str] = mapped_column(ForeignKey("User.id", ondelete="CASCADE"), primary_key=True)
  bank_activity: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
  budget_alerts: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
  payment_reminders: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
  monthly_summary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
  timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="UTC")
  quiet_start: Mapped[int | None] = mapped_column(Integer, nullable=True)
  quiet_end: Mapped[int | None] = mapped_column(Integer, nullable=True)


class NotificationDelivery(Base):
  __tablename__ = "notification_deliveries"
  __table_args__ = (
    UniqueConstraint("notification_id", "subscription_id", name="uq_notification_delivery_subscription"),
    Index("ix_notification_delivery_pending", "status", "next_attempt_at"),
  )
  id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
  notification_id: Mapped[str] = mapped_column(ForeignKey("notifications.id", ondelete="CASCADE"), nullable=False)
  subscription_id: Mapped[str] = mapped_column(ForeignKey("push_subscriptions.id", ondelete="CASCADE"), nullable=False)
  status: Mapped[str] = mapped_column(String(24), nullable=False, default="pending")
  attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
  next_attempt_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=now_utc)
  last_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
  last_error: Mapped[str | None] = mapped_column(String(64), nullable=True)
  created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=now_utc)
