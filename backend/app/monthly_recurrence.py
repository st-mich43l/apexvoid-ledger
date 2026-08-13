"""Shared monthly recurrence primitives used by expenses and expected income."""

from __future__ import annotations

import calendar
import re
from datetime import datetime, timedelta, timezone
from typing import Protocol

from fastapi import HTTPException

from .cashflow import as_utc

MONTH_PATTERN = re.compile(r"^(\d{4})-(\d{2})$")
NAME_MAX_LENGTH = 120


class EffectiveInterval(Protocol):
  effective_from_month: datetime
  effective_until_month: datetime | None


def parse_month(value: str) -> datetime:
  match = MONTH_PATTERN.fullmatch(value.strip())
  if match is None:
    raise HTTPException(status_code=422, detail="Month must use YYYY-MM format")
  year = int(match.group(1))
  month = int(match.group(2))
  if month < 1 or month > 12:
    raise HTTPException(status_code=422, detail="Month must use YYYY-MM format")
  return datetime(year, month, 1, tzinfo=timezone.utc)


def format_month(value: datetime) -> str:
  value = as_utc(value)
  return f"{value.year:04d}-{value.month:02d}"


def next_month(value: datetime) -> datetime:
  value = as_utc(value)
  if value.month == 12:
    return datetime(value.year + 1, 1, 1, tzinfo=timezone.utc)
  return datetime(value.year, value.month + 1, 1, tzinfo=timezone.utc)


def previous_month(value: datetime) -> datetime:
  value = as_utc(value)
  if value.month == 1:
    return datetime(value.year - 1, 12, 1, tzinfo=timezone.utc)
  return datetime(value.year, value.month - 1, 1, tzinfo=timezone.utc)


def inclusive_end_to_exclusive(end_month: datetime | None) -> datetime | None:
  if end_month is None:
    return None
  return next_month(end_month)


def exclusive_until_to_inclusive_end(until: datetime | None) -> datetime | None:
  if until is None:
    return None
  return previous_month(until)


def due_at_for_month(year: int, month: int, due_day: int) -> datetime:
  last_day = calendar.monthrange(year, month)[1]
  day = min(due_day, last_day)
  return datetime(year, month, day, tzinfo=timezone.utc)


def months_touching(start: datetime, end: datetime) -> list[datetime]:
  start = as_utc(start)
  end = as_utc(end)
  if end <= start:
    return []
  cursor = datetime(start.year, start.month, 1, tzinfo=timezone.utc)
  last = end - timedelta(microseconds=1)
  last_month = datetime(last.year, last.month, 1, tzinfo=timezone.utc)
  months: list[datetime] = []
  while cursor <= last_month:
    months.append(cursor)
    cursor = next_month(cursor)
  return months


def revision_covers_month(revision: EffectiveInterval, month_start: datetime) -> bool:
  month_start = as_utc(month_start)
  from_month = as_utc(revision.effective_from_month)
  until = (
    as_utc(revision.effective_until_month)
    if revision.effective_until_month is not None
    else None
  )
  if from_month > month_start:
    return False
  if until is not None and month_start >= until:
    return False
  return True


def normalize_name(name: str) -> str:
  cleaned = re.sub(r"\s+", " ", name.strip())
  if not cleaned:
    raise HTTPException(status_code=422, detail="Name is required")
  if len(cleaned) > NAME_MAX_LENGTH:
    raise HTTPException(
      status_code=422, detail=f"Name must be at most {NAME_MAX_LENGTH} characters"
    )
  return cleaned
