"""add recurring expenses with effective-dated revisions

Revision ID: 0015
Revises: 0014
Create Date: 2026-08-13
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0015"
down_revision: Union[str, None] = "0014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
  op.create_table(
    "RecurringExpense",
    sa.Column("id", sa.String(), nullable=False),
    sa.Column("userId", sa.String(), nullable=False),
    sa.Column("createdAt", sa.DateTime(timezone=True), nullable=False),
    sa.Column("updatedAt", sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(["userId"], ["User.id"], ondelete="CASCADE"),
    sa.PrimaryKeyConstraint("id"),
  )
  op.create_index("ix_recurring_expense_user_id", "RecurringExpense", ["userId"])

  op.create_table(
    "RecurringExpenseRevision",
    sa.Column("id", sa.String(), nullable=False),
    sa.Column("recurringExpenseId", sa.String(), nullable=False),
    sa.Column("name", sa.String(length=120), nullable=False),
    sa.Column("categoryId", sa.String(), nullable=False),
    sa.Column("amount", sa.Numeric(precision=18, scale=2), nullable=False),
    sa.Column("currency", sa.String(length=3), nullable=False),
    sa.Column("dueDay", sa.Integer(), nullable=False),
    sa.Column("effectiveFromMonth", sa.DateTime(timezone=True), nullable=False),
    sa.Column("effectiveUntilMonth", sa.DateTime(timezone=True), nullable=True),
    sa.Column("createdAt", sa.DateTime(timezone=True), nullable=False),
    sa.CheckConstraint("amount > 0", name="ck_recurring_expense_revision_amount"),
    sa.CheckConstraint(
      '"dueDay" >= 1 AND "dueDay" <= 31',
      name="ck_recurring_expense_revision_due_day",
    ),
    sa.CheckConstraint(
      "currency IN ('USD', 'EUR', 'GBP', 'AUD', 'JPY', 'CNY', 'VND')",
      name="ck_recurring_expense_revision_currency",
    ),
    sa.CheckConstraint(
      '"effectiveUntilMonth" IS NULL OR "effectiveUntilMonth" >= "effectiveFromMonth"',
      name="ck_recurring_expense_revision_interval",
    ),
    sa.ForeignKeyConstraint(
      ["recurringExpenseId"], ["RecurringExpense.id"], ondelete="CASCADE"
    ),
    sa.ForeignKeyConstraint(["categoryId"], ["Category.id"], ondelete="RESTRICT"),
    sa.PrimaryKeyConstraint("id"),
  )
  op.create_index(
    "ix_recurring_expense_revision_series",
    "RecurringExpenseRevision",
    ["recurringExpenseId"],
  )
  op.create_index(
    "ix_recurring_expense_revision_effective",
    "RecurringExpenseRevision",
    ["effectiveFromMonth", "effectiveUntilMonth"],
  )


def downgrade() -> None:
  op.drop_index(
    "ix_recurring_expense_revision_effective",
    table_name="RecurringExpenseRevision",
  )
  op.drop_index(
    "ix_recurring_expense_revision_series",
    table_name="RecurringExpenseRevision",
  )
  op.drop_table("RecurringExpenseRevision")
  op.drop_index("ix_recurring_expense_user_id", table_name="RecurringExpense")
  op.drop_table("RecurringExpense")
