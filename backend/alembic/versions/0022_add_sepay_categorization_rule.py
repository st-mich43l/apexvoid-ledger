"""add optional outgoing SePay categorization rule to connected account

Revision ID: 0022
Revises: 0021
Create Date: 2026-10-22
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0022"
down_revision: Union[str, None] = "0021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
  op.add_column(
    "FinancialAccount",
    sa.Column("autoCategoryId", sa.String(), nullable=True),
  )
  op.add_column(
    "FinancialAccount",
    sa.Column("autoDescriptionContains", sa.String(length=160), nullable=True),
  )
  op.add_column(
    "FinancialAccount",
    sa.Column("autoReferenceContains", sa.String(length=160), nullable=True),
  )
  op.add_column(
    "FinancialAccount",
    sa.Column("autoRuleEnabled", sa.Boolean(), nullable=False, server_default=sa.false()),
  )
  op.create_foreign_key(
    "fk_financial_account_auto_category",
    "FinancialAccount",
    "Category",
    ["autoCategoryId"],
    ["id"],
    ondelete="SET NULL",
  )
  op.alter_column("FinancialAccount", "autoRuleEnabled", server_default=None)


def downgrade() -> None:
  op.drop_constraint(
    "fk_financial_account_auto_category", "FinancialAccount", type_="foreignkey"
  )
  op.drop_column("FinancialAccount", "autoRuleEnabled")
  op.drop_column("FinancialAccount", "autoReferenceContains")
  op.drop_column("FinancialAccount", "autoDescriptionContains")
  op.drop_column("FinancialAccount", "autoCategoryId")
