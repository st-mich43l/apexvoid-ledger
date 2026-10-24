"""add SePay webhook authentication method fields

Revision ID: 0024
Revises: 0023
Create Date: 2026-10-24
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0024"
down_revision: Union[str, None] = "0023"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
  op.add_column("FinancialAccount", sa.Column("webhookAuthType", sa.String(length=24), nullable=True))
  op.add_column(
    "FinancialAccount",
    sa.Column("webhookAuthClientIdCiphertext", sa.String(length=2048), nullable=True),
  )
  op.execute(
    'UPDATE "FinancialAccount" SET "webhookAuthType" = \'api_key\' '
    'WHERE "webhookAuthCiphertext" IS NOT NULL'
  )


def downgrade() -> None:
  op.drop_column("FinancialAccount", "webhookAuthClientIdCiphertext")
  op.drop_column("FinancialAccount", "webhookAuthType")
