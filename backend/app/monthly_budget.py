"""Monthly spending-plan persistence and budget-versus-actual composition."""

from __future__ import annotations

from calendar import monthrange
from datetime import date, datetime, timezone
from decimal import ROUND_HALF_UP, Decimal

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from .cashflow_report import MONEY_QUANTUM
from .exchange_rates import FrankfurterExchangeRateProvider
from .models import Category, MonthlyBudget, MonthlyBudgetAllocation
from .monthly_routine import compute_monthly_routine
from .schemas import (
  CurrencyConversionRate,
  MonthlyBudgetAllocationInput,
  MonthlyBudgetAllocationRead,
  MonthlyBudgetSummary,
  MonthlyBudgetUpsert,
  UnbudgetedCategoryRead,
)


def current_utc_date() -> date:
  return datetime.now(timezone.utc).date()


def _money(value: Decimal) -> Decimal:
  return value.quantize(MONEY_QUANTUM, rounding=ROUND_HALF_UP)


def previous_month(year: int, month: int) -> tuple[int, int]:
  if month == 1:
    return year - 1, 12
  return year, month - 1


def get_owned_budget(
  db: Session,
  user_id: str,
  year: int,
  month: int,
) -> MonthlyBudget | None:
  return (
    db.query(MonthlyBudget)
    .options(
      selectinload(MonthlyBudget.allocations).joinedload(
        MonthlyBudgetAllocation.category
      )
    )
    .filter(
      MonthlyBudget.user_id == user_id,
      MonthlyBudget.year == year,
      MonthlyBudget.month == month,
    )
    .first()
  )


def _validated_categories(
  db: Session,
  user_id: str,
  allocations: list[MonthlyBudgetAllocationInput],
) -> dict[str, Category]:
  category_ids = [allocation.category_id for allocation in allocations]
  if not category_ids:
    return {}

  categories = (
    db.query(Category)
    .filter(Category.user_id == user_id, Category.id.in_(category_ids))
    .all()
  )
  by_id = {category.id: category for category in categories}
  if len(by_id) != len(category_ids):
    raise HTTPException(status_code=404, detail="Category not found")

  for category_id in category_ids:
    category = by_id[category_id]
    if category.category_type != "expense":
      raise HTTPException(
        status_code=422,
        detail=f"{category.name} is not an expense category",
      )
    if not category.is_active:
      raise HTTPException(
        status_code=422,
        detail=f"{category.name} is inactive and cannot receive a new allocation",
      )
  return by_id


def save_monthly_budget(
  db: Session,
  user_id: str,
  preferred_currency: str | None,
  year: int,
  month: int,
  payload: MonthlyBudgetUpsert,
) -> MonthlyBudget:
  # Validate every reference before mutating the current snapshot so a bad
  # replacement cannot partially erase a valid plan.
  categories = _validated_categories(db, user_id, payload.allocations)
  budget = get_owned_budget(db, user_id, year, month)

  try:
    if budget is None:
      if preferred_currency is None:
        raise HTTPException(status_code=422, detail="Choose an account currency first")
      if payload.currency != preferred_currency:
        raise HTTPException(
          status_code=422,
          detail="A new budget must use the account's current currency",
        )
      now = datetime.now(timezone.utc)
      budget = MonthlyBudget(
        user_id=user_id,
        year=year,
        month=month,
        currency=payload.currency,
        planned_savings_amount=_money(payload.planned_savings),
        created_at=now,
        updated_at=now,
      )
      db.add(budget)
      db.flush()
    else:
      if payload.currency != budget.currency:
        raise HTTPException(
          status_code=409,
          detail="Budget currency is fixed for this month; reset the budget to use another currency",
        )
      budget.planned_savings_amount = _money(payload.planned_savings)
      budget.updated_at = datetime.now(timezone.utc)
      budget.allocations.clear()
      # Delete before re-inserting so unchanged categories do not briefly violate
      # the unique budget/category constraint. The surrounding transaction still
      # rolls back as a unit if any later statement fails.
      db.flush()

    now = datetime.now(timezone.utc)
    budget.allocations.extend(
      MonthlyBudgetAllocation(
        category_id=categories[allocation.category_id].id,
        amount=_money(allocation.amount),
        created_at=now,
        updated_at=now,
      )
      for allocation in payload.allocations
    )
    db.commit()
  except IntegrityError as error:
    db.rollback()
    raise HTTPException(status_code=409, detail="Monthly budget could not be saved") from error

  saved = get_owned_budget(db, user_id, year, month)
  if saved is None:  # pragma: no cover - defensive after a successful commit
    raise HTTPException(status_code=500, detail="Monthly budget was not persisted")
  return saved


def delete_monthly_budget(db: Session, user_id: str, year: int, month: int) -> None:
  budget = get_owned_budget(db, user_id, year, month)
  if budget is None:
    raise HTTPException(status_code=404, detail="Monthly budget not found")
  db.delete(budget)
  db.commit()


def copy_previous_monthly_budget(
  db: Session,
  user_id: str,
  year: int,
  month: int,
) -> MonthlyBudget:
  if get_owned_budget(db, user_id, year, month) is not None:
    raise HTTPException(status_code=409, detail="The target month already has a budget")

  source_year, source_month = previous_month(year, month)
  source = get_owned_budget(db, user_id, source_year, source_month)
  if source is None:
    raise HTTPException(status_code=404, detail="The previous month has no budget to copy")

  unavailable = sorted(
    {
      allocation.category.name
      for allocation in source.allocations
      if not allocation.category.is_active
      or allocation.category.category_type != "expense"
    }
  )
  if unavailable:
    raise HTTPException(
      status_code=422,
      detail="Cannot copy the budget because these categories are unavailable: "
      + ", ".join(unavailable),
    )

  now = datetime.now(timezone.utc)
  copied = MonthlyBudget(
    user_id=user_id,
    year=year,
    month=month,
    currency=source.currency,
    planned_savings_amount=source.planned_savings_amount,
    created_at=now,
    updated_at=now,
  )
  copied.allocations = [
    MonthlyBudgetAllocation(
      category_id=allocation.category_id,
      amount=allocation.amount,
      created_at=now,
      updated_at=now,
    )
    for allocation in source.allocations
  ]
  db.add(copied)
  try:
    db.commit()
  except IntegrityError as error:
    db.rollback()
    raise HTTPException(status_code=409, detail="The target month already has a budget") from error

  result = get_owned_budget(db, user_id, year, month)
  if result is None:  # pragma: no cover - defensive after a successful commit
    raise HTTPException(status_code=500, detail="Copied budget was not persisted")
  return result


def monthly_budget_summary(
  db: Session,
  user_id: str,
  preferred_currency: str | None,
  year: int,
  month: int,
  rate_provider: FrankfurterExchangeRateProvider,
) -> MonthlyBudgetSummary:
  budget = get_owned_budget(db, user_id, year, month)
  currency = budget.currency if budget is not None else preferred_currency
  if currency is None:
    raise HTTPException(status_code=422, detail="Choose an account currency first")

  routine = compute_monthly_routine(db, user_id, year, month, currency, rate_provider)
  comparison_complete = not routine.unconverted_currencies
  actual_by_category = {
    item.category_id: item for item in routine.variable_categories
  }
  allocated_category_ids = {
    allocation.category_id for allocation in budget.allocations
  } if budget is not None else set()

  allocation_reads: list[MonthlyBudgetAllocationRead] = []
  if budget is not None:
    for allocation in sorted(
      budget.allocations,
      key=lambda item: item.category.name.casefold(),
    ):
      actual = actual_by_category.get(allocation.category_id)
      spent = actual.amount if actual is not None else Decimal("0.00")
      remaining = _money(allocation.amount - spent) if comparison_complete else None
      utilization = (
        (spent / allocation.amount * Decimal("100")).quantize(
          Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        if comparison_complete
        else None
      )
      allocation_reads.append(
        MonthlyBudgetAllocationRead(
          category_id=allocation.category_id,
          category_name=allocation.category.name,
          category_icon=allocation.category.icon,
          category_active=allocation.category.is_active,
          allocated_amount=allocation.amount,
          actual_spent=spent,
          remaining_amount=remaining,
          utilization_percent=utilization,
        )
      )

  unbudgeted_spending = [
    item
    for item in routine.variable_categories
    if item.category_id not in allocated_category_ids
  ]
  unbudgeted = [
    UnbudgetedCategoryRead(
      category_id=item.category_id,
      category_name=item.name,
      category_icon=item.icon,
      actual_spent=item.amount,
    )
    for item in unbudgeted_spending
  ]
  unbudgeted_total = _money(
    sum((item.amount for item in unbudgeted_spending), Decimal("0"))
  )

  planned_savings: Decimal | None = None
  available_for_planning: Decimal | None = None
  planned_total: Decimal | None = None
  unallocated_buffer: Decimal | None = None
  safe_to_spend: Decimal | None = None
  daily_safe_to_spend: Decimal | None = None
  if budget is not None:
    planned_savings = _money(budget.planned_savings_amount)
    available_for_planning = _money(routine.baseline_available - planned_savings)
    planned_total = _money(
      sum((allocation.amount for allocation in budget.allocations), Decimal("0"))
    )
    unallocated_buffer = _money(available_for_planning - planned_total)
    if comparison_complete:
      safe_to_spend = _money(planned_total - routine.actual_variable_expense_total)
      today = current_utc_date()
      if (year, month) == (today.year, today.month):
        days_remaining = monthrange(year, month)[1] - today.day + 1
        daily_safe_to_spend = _money(
          max(safe_to_spend, Decimal("0")) / Decimal(days_remaining)
        )

  conversion_rates = [
    CurrencyConversionRate(
      source_currency=quote.source_currency,
      target_currency=quote.target_currency,
      rate=quote.rate,
      rate_date=quote.rate_date,
    )
    for quote in sorted(
      routine.used_rates.values(),
      key=lambda item: (item.source_currency, item.rate_date),
    )
  ]
  has_conversions = bool(routine.converted_currencies)

  return MonthlyBudgetSummary(
    year=year,
    month=month,
    has_budget=budget is not None,
    currency=currency,
    baseline_available=routine.baseline_available,
    planned_savings_amount=planned_savings,
    available_for_variable_planning=available_for_planning,
    planned_variable_budget_total=planned_total,
    unallocated_buffer=unallocated_buffer,
    actual_variable_expense_total=routine.actual_variable_expense_total,
    remaining_variable_budget=safe_to_spend,
    safe_to_spend=safe_to_spend,
    daily_safe_to_spend=daily_safe_to_spend,
    unbudgeted_spend_total=unbudgeted_total if budget is not None else None,
    allocations=allocation_reads,
    unbudgeted_categories=unbudgeted if budget is not None else [],
    budget_comparison_complete=comparison_complete,
    converted_currencies=sorted(routine.converted_currencies),
    unconverted_currencies=sorted(routine.unconverted_currencies),
    conversion_rates=conversion_rates,
    exchange_rate_provider=rate_provider.provider_name if has_conversions else None,
    exchange_rate_provider_url=rate_provider.provider_url if has_conversions else None,
  )
