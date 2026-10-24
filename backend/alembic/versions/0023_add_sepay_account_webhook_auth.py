"""add per-account SePay webhook authentication credential

Revision ID: 0023
Revises: 0022
Create Date: 2026-10-24
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0023"
down_revision: Union[str, None] = "0022"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
  op.add_column(
    "FinancialAccount",
    sa.Column("webhookAuthCiphertext", sa.String(length=2048), nullable=True),
  )


def downgrade() -> None:
  op.drop_column("FinancialAccount", "webhookAuthCiphertext")
