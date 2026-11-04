"""Create inbox entries and outbox rows within the caller's transaction."""
from sqlalchemy.orm import Session

from .notification_models import Notification, NotificationDelivery, NotificationPreference, PushSubscription


def queue_bank_activity(db: Session, user_id: str, activity_id: str, needs_review: bool) -> None:
  preferences = db.get(NotificationPreference, user_id)
  if preferences is not None and not preferences.bank_activity:
    return
  notification = Notification(
    user_id=user_id,
    event_type="bank_activity",
    event_key=activity_id,
    title="ApexVoid Ledger",
    body="New bank activity requires your review." if needs_review else "New bank activity was recorded.",
    destination="/cashflow",
  )
  db.add(notification)
  db.flush()
  for subscription in db.query(PushSubscription).filter(PushSubscription.user_id == user_id, PushSubscription.enabled.is_(True)).all():
    db.add(NotificationDelivery(notification_id=notification.id, subscription_id=subscription.id))
