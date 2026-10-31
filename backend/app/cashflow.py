from __future__ import annotations

import re
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .models import Category

DEFAULT_CATEGORIES = {
  "expense": [
    ("Food", "🍜"),
    ("Housing", "🏠"),
    ("Transport", "🚗"),
    ("Shopping", "🛍️"),
    ("Entertainment", "🎬"),
    ("Utilities", "💡"),
    ("Subscriptions", "🔁"),
    ("Health", "❤️"),
    ("Spa & Beauty", "💆"),
    ("Travel", "✈️"),
    ("Hotel", "🏨"),
    ("Gifts", "🎁"),
    ("Loan", "🏦"),
    ("Credit Card", "💳"),
    ("Support", "🛟"),
    ("Monthly Living Budget", "💸"),
    ("Other", "📦"),
  ],
  "income": [
    ("Salary", "💼"),
    ("Bonus", "✨"),
    ("Trading", "📈"),
    ("Interest", "💰"),
    ("Other Income", "➕"),
  ],
}

# SePay timestamps describe activity on Vietnam's banking day. Persisted
# values remain UTC, while reports use this zone for calendar boundaries.
REPORTING_TIME_ZONE = ZoneInfo("Asia/Ho_Chi_Minh")


def normalize_category_name(name: str) -> str:
  return re.sub(r"\s+", " ", name.strip()).casefold()


def display_category_name(name: str) -> str:
  return re.sub(r"\s+", " ", name.strip())


def as_utc(value: datetime) -> datetime:
  if value.tzinfo is None:
    return value.replace(tzinfo=timezone.utc)
  return value.astimezone(timezone.utc)


def month_range(year: int, month: int) -> tuple[datetime, datetime]:
  start = datetime(year, month, 1, tzinfo=REPORTING_TIME_ZONE)
  if month == 12:
    end = datetime(year + 1, 1, 1, tzinfo=REPORTING_TIME_ZONE)
  else:
    end = datetime(year, month + 1, 1, tzinfo=REPORTING_TIME_ZONE)
  return start.astimezone(timezone.utc), end.astimezone(timezone.utc)


def reporting_month(value: datetime) -> tuple[int, int]:
  local = as_utc(value).astimezone(REPORTING_TIME_ZONE)
  return local.year, local.month


def reporting_date(value: datetime):
  return as_utc(value).astimezone(REPORTING_TIME_ZONE).date()


def ensure_default_categories(db: Session, user_id: str) -> None:
  existing = {
    (category.category_type, category.normalized_name)
    for category in db.query(Category).filter(Category.user_id == user_id).all()
  }
  now = datetime.now(timezone.utc)
  created = False

  for category_type, defaults in DEFAULT_CATEGORIES.items():
    for name, icon in defaults:
      normalized_name = normalize_category_name(name)
      if (category_type, normalized_name) in existing:
        continue
      db.add(
        Category(
          user_id=user_id,
          name=name,
          normalized_name=normalized_name,
          category_type=category_type,
          icon=icon,
          created_at=now,
          updated_at=now,
        )
      )
      created = True

  if created:
    try:
      db.commit()
    except IntegrityError:
      # Two first-time requests can race after both observe no defaults.
      # The uniqueness constraint decides the winner; if the other
      # request completed the set, this request can safely continue.
      db.rollback()
      persisted = {
        (category.category_type, category.normalized_name)
        for category in db.query(Category).filter(Category.user_id == user_id).all()
      }
      required = {
        (category_type, normalize_category_name(name))
        for category_type, defaults in DEFAULT_CATEGORIES.items()
        for name, _icon in defaults
      }
      if not required.issubset(persisted):
        raise
