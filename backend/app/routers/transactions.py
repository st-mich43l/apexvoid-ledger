from datetime import datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..auth import require_password_changed
from ..cashflow import as_utc, month_range
from ..database import get_db
from ..models import Category, Transaction, User
from ..schemas import (
    TransactionCreate,
    TransactionRead,
    TransactionUpdate,
    WeeklyExpenseBatchCreate,
)

router = APIRouter(prefix="/api/transactions", tags=["transactions"])
MONTH_LABELS = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")


def _weekly_group_label(week_ending: datetime) -> str:
    month_start = week_ending.replace(day=1)
    week_start = max(month_start, week_ending - timedelta(days=week_ending.weekday()))
    month_label = MONTH_LABELS[week_ending.month - 1]
    if week_start.day == week_ending.day:
        return f"{week_start.day} {month_label}"
    return f"{week_start.day}–{week_ending.day} {month_label}"


def _serialize(transaction: Transaction) -> TransactionRead:
    return TransactionRead(
        id=transaction.id,
        type=transaction.transaction_type,
        category_id=transaction.category_id,
        category_name=transaction.category.name,
        category_icon=transaction.category.icon,
        amount=transaction.amount,
        currency=transaction.currency,
        occurred_at=transaction.occurred_at,
        description=transaction.description,
        source=transaction.source,
        created_at=transaction.created_at,
        updated_at=transaction.updated_at,
    )


def _get_or_404(db: Session, transaction_id: str, user_id: str) -> Transaction:
    transaction = (
        db.query(Transaction)
        .filter(Transaction.id == transaction_id, Transaction.user_id == user_id)
        .first()
    )
    if transaction is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return transaction


def _get_category_or_404(db: Session, category_id: str, user_id: str) -> Category:
    category = (
        db.query(Category)
        .filter(Category.id == category_id, Category.user_id == user_id)
        .first()
    )
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")
    return category


def _validate_category(category: Category, transaction_type: str, require_active: bool) -> None:
    if require_active and not category.is_active:
        raise HTTPException(status_code=409, detail="Inactive categories cannot be assigned")
    if category.category_type != transaction_type:
        raise HTTPException(status_code=422, detail="Category type must match transaction type")


@router.get("", response_model=list[TransactionRead])
def list_transactions(
    year: int | None = Query(default=None, ge=1, le=9999),
    month: int | None = Query(default=None, ge=1, le=12),
    transaction_type: Literal["income", "expense"] | None = Query(default=None, alias="type"),
    category_id: str | None = Query(default=None, alias="categoryId"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_password_changed),
):
    if (year is None) != (month is None):
        raise HTTPException(status_code=422, detail="Year and month must be provided together")

    query = db.query(Transaction).filter(Transaction.user_id == current_user.id)
    if year is not None and month is not None:
        start, end = month_range(year, month)
        query = query.filter(Transaction.occurred_at >= start, Transaction.occurred_at < end)
    if transaction_type is not None:
        query = query.filter(Transaction.transaction_type == transaction_type)
    if category_id is not None:
        query = query.filter(Transaction.category_id == category_id)

    transactions = query.order_by(Transaction.occurred_at.desc(), Transaction.created_at.desc()).all()
    return [_serialize(transaction) for transaction in transactions]


@router.post("", response_model=TransactionRead, status_code=201)
def create_transaction(
    payload: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_password_changed),
):
    category = _get_category_or_404(db, payload.category_id, current_user.id)
    _validate_category(category, payload.type, require_active=True)
    currency = payload.currency or current_user.preferred_currency
    if currency is None:
        raise HTTPException(status_code=422, detail="Select a currency before adding transactions")

    transaction = Transaction(
        user_id=current_user.id,
        transaction_type=payload.type,
        category_id=category.id,
        amount=payload.amount,
        currency=currency,
        occurred_at=as_utc(payload.occurred_at),
        description=payload.description,
        source="manual",
    )
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    return _serialize(transaction)


@router.post("/weekly-expenses", response_model=list[TransactionRead], status_code=201)
def create_weekly_expenses(
    payload: WeeklyExpenseBatchCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_password_changed),
):
    category_ids = [entry.category_id for entry in payload.entries]
    owned_categories = (
        db.query(Category)
        .filter(Category.user_id == current_user.id, Category.id.in_(category_ids))
        .all()
    )
    categories_by_id = {category.id: category for category in owned_categories}
    if len(categories_by_id) != len(category_ids):
        raise HTTPException(status_code=404, detail="Category not found")

    for category in owned_categories:
        _validate_category(category, "expense", require_active=True)

    currency = payload.currency or current_user.preferred_currency
    if currency is None:
        raise HTTPException(status_code=422, detail="Select a currency before adding transactions")

    occurred_at = as_utc(payload.week_ending)
    weekly_group = _weekly_group_label(occurred_at)
    transactions = [
        Transaction(
            user_id=current_user.id,
            transaction_type="expense",
            category_id=entry.category_id,
            amount=entry.amount,
            currency=currency,
            occurred_at=occurred_at,
            description=entry.description
            or f"Weekly total · {weekly_group}",
            source="manual",
        )
        for entry in payload.entries
    ]
    db.add_all(transactions)
    db.commit()
    for transaction in transactions:
        db.refresh(transaction)
    return [_serialize(transaction) for transaction in transactions]


@router.put("/{transaction_id}", response_model=TransactionRead)
def update_transaction(
    transaction_id: str,
    payload: TransactionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_password_changed),
):
    transaction = _get_or_404(db, transaction_id, current_user.id)
    changes = payload.model_dump(exclude_unset=True)
    required_fields = ("type", "category_id", "amount", "currency", "occurred_at")
    if any(changes.get(field) is None for field in required_fields if field in changes):
        raise HTTPException(status_code=422, detail="Transaction fields cannot be null")

    next_type = changes.get("type", transaction.transaction_type)
    next_category_id = changes.get("category_id", transaction.category_id)
    category = _get_category_or_404(db, next_category_id, current_user.id)
    _validate_category(
        category,
        next_type,
        require_active=next_category_id != transaction.category_id,
    )

    transaction.transaction_type = next_type
    transaction.category_id = next_category_id
    if "amount" in changes:
        transaction.amount = changes["amount"]
    if "currency" in changes:
        transaction.currency = changes["currency"]
    if "occurred_at" in changes:
        transaction.occurred_at = as_utc(changes["occurred_at"])
    if "description" in changes:
        transaction.description = changes["description"]
    db.commit()
    db.refresh(transaction)
    return _serialize(transaction)


@router.delete("/{transaction_id}", status_code=204)
def delete_transaction(
    transaction_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_password_changed),
):
    transaction = _get_or_404(db, transaction_id, current_user.id)
    db.delete(transaction)
    db.commit()
