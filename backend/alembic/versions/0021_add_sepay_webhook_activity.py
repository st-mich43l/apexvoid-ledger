"""add durable SePay webhook bank activity inbox

Revision ID: 0021
Revises: 0020
Create Date: 2026-10-22
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0021"
down_revision: Union[str, None] = "0020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
  op.add_column(
    "FinancialAccount",
    sa.Column("accountNumberFingerprint", sa.String(length=64), nullable=True),
  )
  op.create_index(
    "ix_financial_account_account_number_fingerprint",
    "FinancialAccount",
    ["accountNumberFingerprint"],
  )
  op.create_table(
    "SePayBankActivity",
    sa.Column("id", sa.String(), nullable=False),
    sa.Column("provider", sa.String(length=32), nullable=False),
    sa.Column("providerTransactionId", sa.String(length=128), nullable=False),
    sa.Column("userId", sa.String(), nullable=True),
    sa.Column("financialAccountId", sa.String(), nullable=True),
    sa.Column("accountNumberFingerprint", sa.String(length=64), nullable=False),
    sa.Column("accountNumberMasked", sa.String(length=32), nullable=False),
    sa.Column("occurredAt", sa.DateTime(timezone=True), nullable=False),
    sa.Column("direction", sa.String(length=8), nullable=False),
    sa.Column("amount", sa.Numeric(precision=18, scale=2), nullable=False),
    sa.Column("currency", sa.String(length=3), nullable=False),
    sa.Column("description", sa.String(length=500), nullable=True),
    sa.Column("bankReference", sa.String(length=255), nullable=True),
    sa.Column("runningBalance", sa.Numeric(precision=18, scale=2), nullable=True),
    sa.Column("processingStatus", sa.String(length=20), nullable=False),
    sa.Column("classification", sa.String(length=32), nullable=False),
    sa.Column("linkedTransactionId", sa.String(), nullable=True),
    sa.Column("matchedKind", sa.String(length=32), nullable=True),
    sa.Column("matchedId", sa.String(length=128), nullable=True),
    sa.Column("receivedAt", sa.DateTime(timezone=True), nullable=False),
    sa.Column("processedAt", sa.DateTime(timezone=True), nullable=True),
    sa.Column("processingError", sa.String(length=240), nullable=True),
    sa.Column("originalPayload", sa.JSON(), nullable=False),
    sa.CheckConstraint('"direction" IN (\'in\', \'out\')', name="ck_sepay_activity_direction"),
    sa.CheckConstraint(
      '"processingStatus" IN (\'pending_review\', \'processed\', \'unmatched\', \'failed\')',
      name="ck_sepay_activity_processing_status",
    ),
    sa.CheckConstraint(
      '"classification" IN (\'unreviewed\', \'income\', \'expense\', \'internal_transfer\', \'loan_repayment\', \'loan_interest\', \'savings_transfer\')',
      name="ck_sepay_activity_classification",
    ),
    sa.CheckConstraint("amount > 0", name="ck_sepay_activity_amount_positive"),
    sa.CheckConstraint(
      '"currency" IN (\'USD\', \'EUR\', \'GBP\', \'AUD\', \'JPY\', \'CNY\', \'VND\')',
      name="ck_sepay_activity_currency",
    ),
    sa.ForeignKeyConstraint(["userId"], ["User.id"], ondelete="SET NULL"),
    sa.ForeignKeyConstraint(["financialAccountId"], ["FinancialAccount.id"], ondelete="SET NULL"),
    sa.ForeignKeyConstraint(["linkedTransactionId"], ["Transaction.id"], ondelete="SET NULL"),
    sa.PrimaryKeyConstraint("id"),
    sa.UniqueConstraint(
      "provider", "providerTransactionId", name="uq_sepay_activity_provider_transaction"
    ),
  )
  op.create_index(
    "ix_sepay_activity_user_occurred",
    "SePayBankActivity",
    ["userId", "occurredAt"],
  )
  op.create_index(
    "ix_sepay_activity_account_occurred",
    "SePayBankActivity",
    ["financialAccountId", "occurredAt"],
  )


def downgrade() -> None:
  op.drop_index("ix_sepay_activity_account_occurred", table_name="SePayBankActivity")
  op.drop_index("ix_sepay_activity_user_occurred", table_name="SePayBankActivity")
  op.drop_table("SePayBankActivity")
  op.drop_index(
    "ix_financial_account_account_number_fingerprint", table_name="FinancialAccount"
  )
  op.drop_column("FinancialAccount", "accountNumberFingerprint")
