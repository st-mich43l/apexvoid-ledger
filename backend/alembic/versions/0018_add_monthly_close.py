"""add monthly close and immutable snapshots

Revision ID: 0018
Revises: 0017
Create Date: 2026-08-14
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0018"
down_revision: Union[str, None] = "0017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_CURRENCY = "('USD', 'EUR', 'GBP', 'AUD', 'JPY', 'CNY', 'VND')"


def upgrade() -> None:
  op.create_table(
    "MonthlyClose",
    sa.Column("id", sa.String(), nullable=False),
    sa.Column("userId", sa.String(), nullable=False),
    sa.Column("year", sa.Integer(), nullable=False),
    sa.Column("month", sa.Integer(), nullable=False),
    sa.Column("createdAt", sa.DateTime(timezone=True), nullable=False),
    sa.Column("updatedAt", sa.DateTime(timezone=True), nullable=False),
    sa.CheckConstraint('"year" >= 1 AND "year" <= 9999', name="ck_monthly_close_year"),
    sa.CheckConstraint('"month" >= 1 AND "month" <= 12', name="ck_monthly_close_month"),
    sa.ForeignKeyConstraint(["userId"], ["User.id"], ondelete="CASCADE"),
    sa.PrimaryKeyConstraint("id"),
    sa.UniqueConstraint("userId", "year", "month", name="uq_monthly_close_user_month"),
  )
  op.create_index("ix_monthly_close_user_id", "MonthlyClose", ["userId"])
  op.create_index(
    "ix_monthly_close_user_year_month", "MonthlyClose", ["userId", "year", "month"]
  )

  op.create_table(
    "MonthlyCloseSnapshot",
    sa.Column("id", sa.String(), nullable=False),
    sa.Column("monthlyCloseId", sa.String(), nullable=False),
    sa.Column("revisionNumber", sa.Integer(), nullable=False),
    sa.Column("reportingCurrency", sa.String(length=3), nullable=False),
    sa.Column("scheduledIncomeTotal", sa.Numeric(precision=18, scale=2), nullable=False),
    sa.Column("manualIncomeTotal", sa.Numeric(precision=18, scale=2), nullable=False),
    sa.Column("incomeTotal", sa.Numeric(precision=18, scale=2), nullable=False),
    sa.Column("fixedExpenseTotal", sa.Numeric(precision=18, scale=2), nullable=False),
    sa.Column("variableExpenseTotal", sa.Numeric(precision=18, scale=2), nullable=False),
    sa.Column("loanPaymentTotal", sa.Numeric(precision=18, scale=2), nullable=False),
    sa.Column("expenseTotal", sa.Numeric(precision=18, scale=2), nullable=False),
    sa.Column("netCashFlow", sa.Numeric(precision=18, scale=2), nullable=False),
    sa.Column("manualTransactionCount", sa.Integer(), nullable=False),
    sa.Column("scheduledIncomeCount", sa.Integer(), nullable=False),
    sa.Column("fixedExpenseCount", sa.Integer(), nullable=False),
    sa.Column("loanPaymentCount", sa.Integer(), nullable=False),
    sa.Column("hasBudget", sa.Boolean(), nullable=False),
    sa.Column("budgetCurrency", sa.String(length=3), nullable=True),
    sa.Column("plannedSavingsAmount", sa.Numeric(precision=18, scale=2), nullable=True),
    sa.Column("plannedVariableBudgetTotal", sa.Numeric(precision=18, scale=2), nullable=True),
    sa.Column("budgetActualVariableExpenseTotal", sa.Numeric(precision=18, scale=2), nullable=True),
    sa.Column("unallocatedBuffer", sa.Numeric(precision=18, scale=2), nullable=True),
    sa.Column("safeToSpend", sa.Numeric(precision=18, scale=2), nullable=True),
    sa.Column("unbudgetedSpendTotal", sa.Numeric(precision=18, scale=2), nullable=True),
    sa.Column("budgetComparisonComplete", sa.Boolean(), nullable=True),
    sa.Column("savingPotExists", sa.Boolean(), nullable=False),
    sa.Column("savingPotApplicable", sa.Boolean(), nullable=False),
    sa.Column("savingPotCurrency", sa.String(length=3), nullable=True),
    sa.Column("savingPotMonthAppliedAmount", sa.Numeric(precision=18, scale=2), nullable=True),
    sa.Column("savingPotSynced", sa.Boolean(), nullable=True),
    sa.Column("conversionComplete", sa.Boolean(), nullable=False),
    sa.Column("note", sa.String(length=240), nullable=True),
    sa.Column("closedAt", sa.DateTime(timezone=True), nullable=False),
    sa.Column("createdAt", sa.DateTime(timezone=True), nullable=False),
    sa.CheckConstraint('"revisionNumber" >= 1', name="ck_monthly_close_snapshot_revision"),
    sa.CheckConstraint(
      f'"reportingCurrency" IN {_CURRENCY}',
      name="ck_monthly_close_snapshot_reporting_currency",
    ),
    sa.CheckConstraint(
      f'"budgetCurrency" IS NULL OR "budgetCurrency" IN {_CURRENCY}',
      name="ck_monthly_close_snapshot_budget_currency",
    ),
    sa.CheckConstraint(
      f'"savingPotCurrency" IS NULL OR "savingPotCurrency" IN {_CURRENCY}',
      name="ck_monthly_close_snapshot_saving_pot_currency",
    ),
    sa.ForeignKeyConstraint(
      ["monthlyCloseId"], ["MonthlyClose.id"], ondelete="CASCADE"
    ),
    sa.PrimaryKeyConstraint("id"),
    sa.UniqueConstraint(
      "monthlyCloseId", "revisionNumber", name="uq_monthly_close_snapshot_revision"
    ),
  )
  op.create_index(
    "ix_monthly_close_snapshot_close_id", "MonthlyCloseSnapshot", ["monthlyCloseId"]
  )


def downgrade() -> None:
  op.drop_index(
    "ix_monthly_close_snapshot_close_id", table_name="MonthlyCloseSnapshot"
  )
  op.drop_table("MonthlyCloseSnapshot")
  op.drop_index("ix_monthly_close_user_year_month", table_name="MonthlyClose")
  op.drop_index("ix_monthly_close_user_id", table_name="MonthlyClose")
  op.drop_table("MonthlyClose")
