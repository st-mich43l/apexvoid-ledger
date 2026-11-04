from datetime import datetime, timezone
import base64
import os

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import HTTPException
from starlette.requests import Request
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.database import Base
from app.models import FinancialAccount, User
from app.bank_activity import ingest_webhook
from app.sepay import account_number_fingerprint
from app.notification_models import Notification, NotificationDelivery, PushSubscription
from app.notification_events import queue_bank_activity
from app.routers.notifications import Preferences, get_preferences, list_notifications, mark_read, put_preferences, require_same_origin, unread_count
from app.routers.push import SubscriptionInput, delete_subscription, register_subscription


@pytest.fixture()
def session():
  engine = create_engine("sqlite:///:memory:")
  Base.metadata.create_all(engine)
  with Session(engine) as db:
    db.add_all([
      User(id="a", username="a", hashed_password="x", is_admin=False, must_change_password=False),
      User(id="b", username="b", hashed_password="x", is_admin=False, must_change_password=False),
    ])
    db.add_all([
      Notification(id="one", user_id="a", event_type="bank", event_key="1", title="Ledger", body="Review", destination="/cashflow", created_at=datetime.now(timezone.utc)),
      Notification(id="two", user_id="b", event_type="bank", event_key="2", title="Ledger", body="Review", destination="/cashflow", created_at=datetime.now(timezone.utc)),
    ])
    db.commit()
    yield db
  engine.dispose()


def test_inbox_is_scoped_and_marks_only_owner_notifications(session):
  alice = session.get(User, "a")
  assert [row["id"] for row in list_notifications(limit=30, offset=0, db=session, user=alice)] == ["one"]
  assert unread_count(db=session, user=alice) == {"count": 1}
  with pytest.raises(HTTPException) as error:
    mark_read("two", db=session, user=alice)
  assert error.value.status_code == 404
  mark_read("one", db=session, user=alice)
  assert unread_count(db=session, user=alice) == {"count": 0}
  assert session.get(Notification, "two").read_at is None


def test_preferences_are_user_scoped_and_validate_timezone(session):
  alice = session.get(User, "a")
  bob = session.get(User, "b")
  assert get_preferences(db=session, user=alice).bank_activity is True
  put_preferences(Preferences(bankActivity=False, timezone="Asia/Ho_Chi_Minh", quietStart=22, quietEnd=7), db=session, user=alice)
  assert get_preferences(db=session, user=alice).bank_activity is False
  assert get_preferences(db=session, user=bob).bank_activity is True
  with pytest.raises(ValueError):
    Preferences(timezone="Not/A_Real_Zone")


def test_bank_event_queues_only_enabled_owner_devices(session):
  session.add_all([
    PushSubscription(id="a1", user_id="a", endpoint_hash="1", material_ciphertext="encrypted", enabled=True),
    PushSubscription(id="a2", user_id="a", endpoint_hash="2", material_ciphertext="encrypted", enabled=False),
    PushSubscription(id="b1", user_id="b", endpoint_hash="3", material_ciphertext="encrypted", enabled=True),
  ])
  session.flush()
  queue_bank_activity(session, "a", "activity-1", True)
  session.flush()
  notification = session.query(Notification).filter_by(event_key="activity-1").one()
  deliveries = session.query(NotificationDelivery).filter_by(notification_id=notification.id).all()
  assert [delivery.subscription_id for delivery in deliveries] == ["a1"]
  assert "review" in notification.body


def test_disabled_bank_preference_does_not_create_inbox_entry(session):
  put_preferences(Preferences(bankActivity=False), db=session, user=session.get(User, "a"))
  queue_bank_activity(session, "a", "activity-disabled", True)
  session.flush()
  assert session.query(Notification).filter_by(event_key="activity-disabled").count() == 0


def test_subscription_is_encrypted_and_cannot_be_taken_by_another_user(session, monkeypatch):
  monkeypatch.setenv("PUSH_SUBSCRIPTION_KEY", base64.urlsafe_b64encode(os.urandom(32)).decode())
  public = ec.generate_private_key(ec.SECP256R1()).public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
  payload = SubscriptionInput(endpoint="https://push.example/path", keys={"p256dh": base64.urlsafe_b64encode(public).decode().rstrip("="), "auth": base64.urlsafe_b64encode(os.urandom(16)).decode().rstrip("=")}, deviceName="Test")
  alice, bob = session.get(User, "a"), session.get(User, "b")
  first = register_subscription(payload, db=session, user=alice)
  second = register_subscription(payload, db=session, user=alice)
  assert first["id"] == second["id"]
  stored = session.get(PushSubscription, first["id"])
  assert payload.endpoint not in stored.material_ciphertext
  with pytest.raises(HTTPException) as error:
    register_subscription(payload, db=session, user=bob)
  assert error.value.status_code == 409
  with pytest.raises(HTTPException) as error:
    delete_subscription(first["id"], db=session, user=bob)
  assert error.value.status_code == 404


def test_sepay_webhook_retry_does_not_duplicate_notifications(session, monkeypatch):
  monkeypatch.setattr('app.bank_activity.sync_if_due', lambda *_args: None)
  session.add(FinancialAccount(id='account', user_id='a', provider='sepay', external_account_id='test', bank_name='Test', account_number_masked='••••0001', account_number_fingerprint=account_number_fingerprint('10000001'), currency='VND', balance_status='verified'))
  session.add(PushSubscription(id='device', user_id='a', endpoint_hash='device-hash', material_ciphertext='encrypted', enabled=True))
  session.commit()
  payload = {'id': 77123, 'gateway': 'Test', 'transactionDate': '2026-11-04 10:00:00', 'accountNumber': '10000001', 'content': 'test', 'transferType': 'out', 'transferAmount': 1000, 'accumulated': 5000, 'referenceCode': 'test-ref'}
  first = ingest_webhook(session, payload)
  second = ingest_webhook(session, payload)
  assert first.id == second.id
  assert session.query(Notification).filter_by(user_id='a', event_type='bank_activity').count() == 1
  assert session.query(NotificationDelivery).filter_by(subscription_id='device').count() == 1


def test_state_changes_require_matching_origin():
  def request(origin):
    headers = [(b'host', b'ledger.example')]
    if origin is not None:
      headers.append((b'origin', origin.encode()))
    return Request({'type': 'http', 'method': 'POST', 'scheme': 'https', 'path': '/', 'headers': headers})
  require_same_origin(request('https://ledger.example'))
  for origin in (None, 'https://attacker.example', 'null', 'https://ledger.example.attacker.example'):
    with pytest.raises(HTTPException) as error:
      require_same_origin(request(origin))
    assert error.value.status_code == 403
