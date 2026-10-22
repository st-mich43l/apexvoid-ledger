from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..auth import require_password_changed
from ..bank_activity import process_activity
from ..cashflow import as_utc, month_range
from ..database import get_db
from ..models import Category, FinancialAccount, SePayBankActivity, Transaction, User
from ..schemas import (
  BankActivityClassify,
  BankActivityClassification,
  BankActivityDirection,
  BankActivityRead,
  SePayCategorizationRuleRead,
  SePayCategorizationRuleUpdate,
)

router = APIRouter(prefix="/api/bank-activities", tags=["bank-activities"])


def _owned_activity(db: Session, activity_id: str, user_id: str) -> SePayBankActivity:
  activity = (
    db.query(SePayBankActivity)
    .filter(SePayBankActivity.id == activity_id, SePayBankActivity.user_id == user_id)
    .first()
  )
  if activity is None:
    raise HTTPException(status_code=404, detail="Bank activity not found")
  return activity


def _serialize(db: Session, activity: SePayBankActivity) -> BankActivityRead:
  account = db.get(FinancialAccount, activity.financial_account_id) if activity.financial_account_id else None
  transaction = db.get(Transaction, activity.linked_transaction_id) if activity.linked_transaction_id else None
  return BankActivityRead(
    id=activity.id,
    provider=activity.provider,
    provider_transaction_id=activity.provider_transaction_id,
    financial_account_id=activity.financial_account_id,
    account_number_masked=activity.account_number_masked,
    bank_name=account.bank_name if account else None,
    occurred_at=activity.occurred_at,
    direction=activity.direction,
    amount=activity.amount,
    currency=activity.currency,
    description=activity.description,
    bank_reference=activity.bank_reference,
    running_balance=activity.running_balance,
    processing_status=activity.processing_status,
    classification=activity.classification,
    linked_transaction_id=activity.linked_transaction_id,
    matched_kind=activity.matched_kind,
    matched_id=activity.matched_id,
    category_id=transaction.category_id if transaction else None,
    category_name=transaction.category.name if transaction else None,
    category_icon=transaction.category.icon if transaction else None,
    processed_at=activity.processed_at,
    received_at=activity.received_at,
  )


def _primary_sepay_account(db: Session, user_id: str) -> FinancialAccount:
  account = (
    db.query(FinancialAccount)
    .filter(FinancialAccount.user_id == user_id, FinancialAccount.provider == "sepay")
    .order_by(FinancialAccount.created_at.asc())
    .first()
  )
  if account is None:
    raise HTTPException(status_code=404, detail="Connect the primary TPBank SePay account first")
  return account


def _serialize_rule(db: Session, account: FinancialAccount) -> SePayCategorizationRuleRead:
  category = db.get(Category, account.auto_category_id) if account.auto_category_id else None
  return SePayCategorizationRuleRead(
    financial_account_id=account.id,
    enabled=bool(
      account.auto_rule_enabled
      and category is not None
      and category.category_type == "expense"
      and category.is_active
    ),
    category_id=category.id if category is not None else None,
    category_name=category.name if category is not None else None,
    description_contains=account.auto_description_contains,
    reference_contains=account.auto_reference_contains,
  )


@router.get("/categorization-rule", response_model=SePayCategorizationRuleRead)
def get_categorization_rule(
  db: Session = Depends(get_db),
  current_user: User = Depends(require_password_changed),
):
  return _serialize_rule(db, _primary_sepay_account(db, current_user.id))


@router.put("/categorization-rule", response_model=SePayCategorizationRuleRead)
def update_categorization_rule(
  payload: SePayCategorizationRuleUpdate,
  db: Session = Depends(get_db),
  current_user: User = Depends(require_password_changed),
):
  account = _primary_sepay_account(db, current_user.id)
  description = payload.description_contains.strip() if payload.description_contains else None
  reference = payload.reference_contains.strip() if payload.reference_contains else None

  category = None
  if payload.category_id is not None:
    category = (
      db.query(Category)
      .filter(Category.id == payload.category_id, Category.user_id == current_user.id)
      .first()
    )
    if category is None:
      raise HTTPException(status_code=404, detail="Category not found")
    if category.category_type != "expense" or (payload.enabled and not category.is_active):
      raise HTTPException(status_code=422, detail="Select an active expense category")

  if payload.enabled and category is None:
    raise HTTPException(status_code=422, detail="An expense category is required for an active rule")
  if payload.enabled and not description and not reference:
    raise HTTPException(
      status_code=422,
      detail="Add a description or bank-reference matcher; amount alone cannot classify transactions",
    )

  account.auto_category_id = category.id if category is not None else None
  account.auto_description_contains = description
  account.auto_reference_contains = reference
  account.auto_rule_enabled = payload.enabled

  # Applying a rule also gives already-received, still-unreviewed events a
  # deterministic chance to be classified. Existing transactions remain
  # protected by the activity/provider identity checks.
  pending = (
    db.query(SePayBankActivity)
    .filter(
      SePayBankActivity.financial_account_id == account.id,
      SePayBankActivity.processing_status == "pending_review",
    )
    .all()
  )
  for activity in pending:
    process_activity(db, activity)
  db.commit()
  db.refresh(account)
  return _serialize_rule(db, account)


@router.get("", response_model=list[BankActivityRead])
def list_bank_activities(
  year: int | None = Query(default=None, ge=1, le=9999),
  month: int | None = Query(default=None, ge=1, le=12),
  direction: BankActivityDirection | None = Query(default=None),
  classification: BankActivityClassification | None = Query(default=None),
  category_id: str | None = Query(default=None, alias="categoryId"),
  account_id: str | None = Query(default=None, alias="accountId"),
  processing_status: Literal["pending_review", "processed", "unmatched", "failed"] | None = Query(default=None, alias="processingStatus"),
  db: Session = Depends(get_db),
  current_user: User = Depends(require_password_changed),
):
  if (year is None) != (month is None):
    raise HTTPException(status_code=422, detail="Year and month must be provided together")

  query = (
    db.query(SePayBankActivity)
    .outerjoin(Transaction, Transaction.id == SePayBankActivity.linked_transaction_id)
    .filter(SePayBankActivity.user_id == current_user.id)
  )
  if year is not None and month is not None:
    start, end = month_range(year, month)
    query = query.filter(SePayBankActivity.occurred_at >= start, SePayBankActivity.occurred_at < end)
  if direction is not None:
    query = query.filter(SePayBankActivity.direction == direction)
  if classification is not None:
    query = query.filter(SePayBankActivity.classification == classification)
  if category_id is not None:
    query = query.filter(Transaction.category_id == category_id)
  if account_id is not None:
    query = query.filter(SePayBankActivity.financial_account_id == account_id)
  if processing_status is not None:
    query = query.filter(SePayBankActivity.processing_status == processing_status)

  activities = query.order_by(SePayBankActivity.occurred_at.desc()).limit(500).all()
  return [_serialize(db, activity) for activity in activities]


@router.patch("/{activity_id}", response_model=BankActivityRead)
def classify_bank_activity(
  activity_id: str,
  payload: BankActivityClassify,
  db: Session = Depends(get_db),
  current_user: User = Depends(require_password_changed),
):
  activity = _owned_activity(db, activity_id, current_user.id)
  if activity.processing_status == "unmatched":
    raise HTTPException(status_code=409, detail="This bank activity is not linked to a Ledger account")

  classification = payload.classification
  if classification in {"income", "expense", "loan_interest"}:
    if payload.category_id is None:
      raise HTTPException(status_code=422, detail="A category is required for income or expense")
    category = (
      db.query(Category)
      .filter(Category.id == payload.category_id, Category.user_id == current_user.id)
      .first()
    )
    if category is None:
      raise HTTPException(status_code=404, detail="Category not found")
    expected_type = "income" if classification == "income" else "expense"
    if category.category_type != expected_type or not category.is_active:
      raise HTTPException(status_code=422, detail="Select an active category with the matching type")

    if activity.linked_transaction_id is None:
      transaction = Transaction(
        user_id=current_user.id,
        transaction_type=expected_type,
        category_id=category.id,
        amount=activity.amount,
        currency=activity.currency,
        occurred_at=as_utc(activity.occurred_at),
        description=activity.description or f"SePay {activity.provider_transaction_id}",
        source="sepay",
        external_id=f"sepay:{activity.provider}:{activity.provider_transaction_id}",
      )
      db.add(transaction)
      db.flush()
      activity.linked_transaction_id = transaction.id
    else:
      transaction = db.get(Transaction, activity.linked_transaction_id)
      if transaction is not None and transaction.source == "sepay":
        transaction.transaction_type = expected_type
        transaction.category_id = category.id
  elif classification == "unreviewed":
    if activity.linked_transaction_id is not None:
      raise HTTPException(status_code=409, detail="A linked transaction must be edited instead")

  activity.classification = classification
  activity.processing_status = "pending_review" if classification == "unreviewed" else "processed"
  activity.processed_at = None if classification == "unreviewed" else datetime.now(timezone.utc)
  activity.processing_error = None
  db.commit()
  db.refresh(activity)
  return _serialize(db, activity)
