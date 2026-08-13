"""add saving pot and monthly application ledger

Revision ID: 0013
Revises: 0012
Create Date: 2026-08-13

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0013"
down_revision: Union[str, None] = "0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
  op.create_table(
    "SavingPot",
    sa.Column("id", sa.String(), nullable=False),
    sa.Column("userId", sa.String(), nullable=False),
    sa.Column("balance", sa.Numeric(precision=18, scale=2), nullable=False),
    sa.Column("currency", sa.String(length=3), nullable=False),
    sa.Column("createdAt", sa.DateTime(timezone=True), nullable=False),
    sa.Column("updatedAt", sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(["userId"], ["User.id"], ondelete="CASCADE"),
    sa.CheckConstraint(
      "currency IN ('USD', 'EUR', 'GBP', 'AUD', 'JPY', 'CNY', 'VND')",
      name="ck_saving_pot_currency",
    ),
    sa.PrimaryKeyConstraint("id"),
    sa.UniqueConstraint("userId", name="uq_saving_pot_user"),
  )
  op.create_index("ix_saving_pot_user_id", "SavingPot", ["userId"])

  op.create_table(
    "SavingPotMonthApplication",
    sa.Column("id", sa.String(), nullable=False),
    sa.Column("savingPotId", sa.String(), nullable=False),
    sa.Column("year", sa.Integer(), nullable=False),
    sa.Column("month", sa.Integer(), nullable=False),
    sa.Column("amountApplied", sa.Numeric(precision=18, scale=2), nullable=False),
    sa.Column("currency", sa.String(length=3), nullable=False),
    sa.Column("appliedAt", sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(["savingPotId"], ["SavingPot.id"], ondelete="CASCADE"),
    sa.CheckConstraint('"month" >= 1 AND "month" <= 12', name="ck_saving_pot_app_month"),
    sa.CheckConstraint(
      "currency IN ('USD', 'EUR', 'GBP', 'AUD', 'JPY', 'CNY', 'VND')",
      name="ck_saving_pot_app_currency",
    ),
    sa.PrimaryKeyConstraint("id"),
    sa.UniqueConstraint(
      "savingPotId", "year", "month", name="uq_saving_pot_month_application"
    ),
  )
  op.create_index(
    "ix_saving_pot_month_application_pot_id",
    "SavingPotMonthApplication",
    ["savingPotId"],
  )


def downgrade() -> None:
  op.drop_index(
    "ix_saving_pot_month_application_pot_id",
    table_name="SavingPotMonthApplication",
  )
  op.drop_table("SavingPotMonthApplication")
  op.drop_index("ix_saving_pot_user_id", table_name="SavingPot")
  op.drop_table("SavingPot")
