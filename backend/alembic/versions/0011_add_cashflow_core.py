"""add cash-flow categories and transactions

Revision ID: 0011
Revises: 0010
Create Date: 2026-08-12

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0011"
down_revision: Union[str, None] = "0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "Category",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("userId", sa.String(), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("normalizedName", sa.String(length=80), nullable=False),
        sa.Column("categoryType", sa.String(length=16), nullable=False),
        sa.Column("icon", sa.String(length=32), nullable=True),
        sa.Column("isActive", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("createdAt", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updatedAt", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["userId"], ["User.id"], ondelete="CASCADE"),
        sa.CheckConstraint('"categoryType" IN (\'income\', \'expense\')', name="ck_category_type"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "userId", "categoryType", "normalizedName", name="uq_category_user_type_name"
        ),
    )
    op.create_index("ix_category_user_id", "Category", ["userId"])

    op.create_table(
        "Transaction",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("userId", sa.String(), nullable=False),
        sa.Column("transactionType", sa.String(length=16), nullable=False),
        sa.Column("categoryId", sa.String(), nullable=False),
        sa.Column("amount", sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("occurredAt", sa.DateTime(timezone=True), nullable=False),
        sa.Column("description", sa.String(length=240), nullable=True),
        sa.Column("source", sa.String(length=20), nullable=False, server_default="manual"),
        sa.Column("externalId", sa.String(length=255), nullable=True),
        sa.Column("createdAt", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updatedAt", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["categoryId"], ["Category.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["userId"], ["User.id"], ondelete="CASCADE"),
        sa.CheckConstraint(
            '"transactionType" IN (\'income\', \'expense\')', name="ck_transaction_type"
        ),
        sa.CheckConstraint("amount > 0", name="ck_transaction_amount_positive"),
        sa.CheckConstraint(
            "currency IN ('USD', 'EUR', 'GBP', 'AUD', 'JPY', 'CNY', 'VND')",
            name="ck_transaction_currency",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_transaction_category_id", "Transaction", ["categoryId"])
    op.create_index(
        "ix_transaction_user_occurred_at", "Transaction", ["userId", "occurredAt"]
    )


def downgrade() -> None:
    op.drop_index("ix_transaction_user_occurred_at", table_name="Transaction")
    op.drop_index("ix_transaction_category_id", table_name="Transaction")
    op.drop_table("Transaction")
    op.drop_index("ix_category_user_id", table_name="Category")
    op.drop_table("Category")
