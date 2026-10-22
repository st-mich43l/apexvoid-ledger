"""add user-owned financial accounts for net worth

Revision ID: 0019
Revises: 0018
Create Date: 2026-10-22
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0019"
down_revision: Union[str, None] = "0018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_CURRENCY = "('USD', 'EUR', 'GBP', 'AUD', 'JPY', 'CNY', 'VND')"
_STATUS = "('verified', 'stale', 'unavailable', 'inactive')"


def upgrade() -> None:
  op.create_table(
    "FinancialAccount",
    sa.Column("id", sa.String(), nullable=False),
    sa.Column("userId", sa.String(), nullable=False),
    sa.Column("provider", sa.String(length=32), nullable=False),
    sa.Column("externalAccountId", sa.String(length=128), nullable=False),
    sa.Column("bankName", sa.String(length=100), nullable=False),
    sa.Column("accountNumberMasked", sa.String(length=32), nullable=False),
    sa.Column("accountName", sa.String(length=160), nullable=True),
    sa.Column("currency", sa.String(length=3), nullable=False),
    sa.Column("balance", sa.Numeric(precision=18, scale=2), nullable=True),
    sa.Column("balanceStatus", sa.String(length=16), nullable=False),
    sa.Column("lastSyncedAt", sa.DateTime(timezone=True), nullable=True),
    sa.Column("lastTransactionAt", sa.DateTime(timezone=True), nullable=True),
    sa.Column("lastSyncAttemptAt", sa.DateTime(timezone=True), nullable=True),
    sa.Column("lastSyncError", sa.String(length=160), nullable=True),
    sa.Column("createdAt", sa.DateTime(timezone=True), nullable=False),
    sa.Column("updatedAt", sa.DateTime(timezone=True), nullable=False),
    sa.CheckConstraint(f'"currency" IN {_CURRENCY}', name="ck_financial_account_currency"),
    sa.CheckConstraint(
      f'"balanceStatus" IN {_STATUS}', name="ck_financial_account_balance_status"
    ),
    sa.ForeignKeyConstraint(["userId"], ["User.id"], ondelete="CASCADE"),
    sa.PrimaryKeyConstraint("id"),
    sa.UniqueConstraint(
      "provider", "externalAccountId", name="uq_financial_account_provider_external"
    ),
  )
  op.create_index("ix_financial_account_user_id", "FinancialAccount", ["userId"])


def downgrade() -> None:
  op.drop_index("ix_financial_account_user_id", table_name="FinancialAccount")
  op.drop_table("FinancialAccount")
