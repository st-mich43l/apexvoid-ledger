"""add recurring expected income with effective-dated revisions

Revision ID: 0016
Revises: 0015
Create Date: 2026-08-13
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0016"
down_revision: Union[str, None] = "0015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
  op.create_table(
    "RecurringIncome",
    sa.Column("id", sa.String(), nullable=False),
    sa.Column("userId", sa.String(), nullable=False),
    sa.Column("createdAt", sa.DateTime(timezone=True), nullable=False),
    sa.Column("updatedAt", sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(["userId"], ["User.id"], ondelete="CASCADE"),
    sa.PrimaryKeyConstraint("id"),
  )
  op.create_index("ix_recurring_income_user_id", "RecurringIncome", ["userId"])

  op.create_table(
    "RecurringIncomeRevision",
    sa.Column("id", sa.String(), nullable=False),
    sa.Column("recurringIncomeId", sa.String(), nullable=False),
    sa.Column("name", sa.String(length=120), nullable=False),
    sa.Column("categoryId", sa.String(), nullable=False),
    sa.Column("amount", sa.Numeric(precision=18, scale=2), nullable=False),
    sa.Column("currency", sa.String(length=3), nullable=False),
    sa.Column("expectedDay", sa.Integer(), nullable=False),
    sa.Column("effectiveFromMonth", sa.DateTime(timezone=True), nullable=False),
    sa.Column("effectiveUntilMonth", sa.DateTime(timezone=True), nullable=True),
    sa.Column("createdAt", sa.DateTime(timezone=True), nullable=False),
    sa.CheckConstraint("amount > 0", name="ck_recurring_income_revision_amount"),
    sa.CheckConstraint(
      '"expectedDay" >= 1 AND "expectedDay" <= 31',
      name="ck_recurring_income_revision_expected_day",
    ),
    sa.CheckConstraint(
      "currency IN ('USD', 'EUR', 'GBP', 'AUD', 'JPY', 'CNY', 'VND')",
      name="ck_recurring_income_revision_currency",
    ),
    sa.CheckConstraint(
      '"effectiveUntilMonth" IS NULL OR "effectiveUntilMonth" >= "effectiveFromMonth"',
      name="ck_recurring_income_revision_interval",
    ),
    sa.ForeignKeyConstraint(
      ["recurringIncomeId"], ["RecurringIncome.id"], ondelete="CASCADE"
    ),
    sa.ForeignKeyConstraint(["categoryId"], ["Category.id"], ondelete="RESTRICT"),
    sa.PrimaryKeyConstraint("id"),
  )
  op.create_index(
    "ix_recurring_income_revision_series",
    "RecurringIncomeRevision",
    ["recurringIncomeId"],
  )
  op.create_index(
    "ix_recurring_income_revision_effective",
    "RecurringIncomeRevision",
    ["effectiveFromMonth", "effectiveUntilMonth"],
  )


def downgrade() -> None:
  op.drop_index(
    "ix_recurring_income_revision_effective",
    table_name="RecurringIncomeRevision",
  )
  op.drop_index(
    "ix_recurring_income_revision_series",
    table_name="RecurringIncomeRevision",
  )
  op.drop_table("RecurringIncomeRevision")
  op.drop_index("ix_recurring_income_user_id", table_name="RecurringIncome")
  op.drop_table("RecurringIncome")
