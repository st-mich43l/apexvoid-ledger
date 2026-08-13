"""add monthly budget and category allocations

Revision ID: 0017
Revises: 0016
Create Date: 2026-08-14
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0017"
down_revision: Union[str, None] = "0016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
  op.create_table(
    "MonthlyBudget",
    sa.Column("id", sa.String(), nullable=False),
    sa.Column("userId", sa.String(), nullable=False),
    sa.Column("year", sa.Integer(), nullable=False),
    sa.Column("month", sa.Integer(), nullable=False),
    sa.Column("currency", sa.String(length=3), nullable=False),
    sa.Column("plannedSavingsAmount", sa.Numeric(precision=18, scale=2), nullable=False),
    sa.Column("createdAt", sa.DateTime(timezone=True), nullable=False),
    sa.Column("updatedAt", sa.DateTime(timezone=True), nullable=False),
    sa.CheckConstraint('"year" >= 1 AND "year" <= 9999', name="ck_monthly_budget_year"),
    sa.CheckConstraint('"month" >= 1 AND "month" <= 12', name="ck_monthly_budget_month"),
    sa.CheckConstraint(
      "currency IN ('USD', 'EUR', 'GBP', 'AUD', 'JPY', 'CNY', 'VND')",
      name="ck_monthly_budget_currency",
    ),
    sa.CheckConstraint(
      '"plannedSavingsAmount" >= 0', name="ck_monthly_budget_planned_savings"
    ),
    sa.ForeignKeyConstraint(["userId"], ["User.id"], ondelete="CASCADE"),
    sa.PrimaryKeyConstraint("id"),
    sa.UniqueConstraint("userId", "year", "month", name="uq_monthly_budget_user_month"),
  )
  op.create_index("ix_monthly_budget_user_id", "MonthlyBudget", ["userId"])

  op.create_table(
    "MonthlyBudgetAllocation",
    sa.Column("id", sa.String(), nullable=False),
    sa.Column("monthlyBudgetId", sa.String(), nullable=False),
    sa.Column("categoryId", sa.String(), nullable=False),
    sa.Column("amount", sa.Numeric(precision=18, scale=2), nullable=False),
    sa.Column("createdAt", sa.DateTime(timezone=True), nullable=False),
    sa.Column("updatedAt", sa.DateTime(timezone=True), nullable=False),
    sa.CheckConstraint("amount > 0", name="ck_monthly_budget_allocation_amount"),
    sa.ForeignKeyConstraint(
      ["monthlyBudgetId"], ["MonthlyBudget.id"], ondelete="CASCADE"
    ),
    sa.ForeignKeyConstraint(["categoryId"], ["Category.id"], ondelete="RESTRICT"),
    sa.PrimaryKeyConstraint("id"),
    sa.UniqueConstraint(
      "monthlyBudgetId", "categoryId", name="uq_monthly_budget_allocation_category"
    ),
  )
  op.create_index(
    "ix_monthly_budget_allocation_budget_id",
    "MonthlyBudgetAllocation",
    ["monthlyBudgetId"],
  )


def downgrade() -> None:
  op.drop_index(
    "ix_monthly_budget_allocation_budget_id", table_name="MonthlyBudgetAllocation"
  )
  op.drop_table("MonthlyBudgetAllocation")
  op.drop_index("ix_monthly_budget_user_id", table_name="MonthlyBudget")
  op.drop_table("MonthlyBudget")
