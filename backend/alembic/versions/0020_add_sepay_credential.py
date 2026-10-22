"""store encrypted per-user SePay credentials

Revision ID: 0020
Revises: 0019
Create Date: 2026-10-22
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0020"
down_revision: Union[str, None] = "0019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
  op.drop_constraint(
    "uq_financial_account_provider_external",
    "FinancialAccount",
    type_="unique",
  )
  op.create_unique_constraint(
    "uq_financial_account_user_provider_external",
    "FinancialAccount",
    ["userId", "provider", "externalAccountId"],
  )
  op.add_column(
    "FinancialAccount",
    sa.Column("credentialCiphertext", sa.String(length=2048), nullable=True),
  )


def downgrade() -> None:
  op.drop_constraint(
    "uq_financial_account_user_provider_external",
    "FinancialAccount",
    type_="unique",
  )
  op.create_unique_constraint(
    "uq_financial_account_provider_external",
    "FinancialAccount",
    ["provider", "externalAccountId"],
  )
  op.drop_column("FinancialAccount", "credentialCiphertext")
