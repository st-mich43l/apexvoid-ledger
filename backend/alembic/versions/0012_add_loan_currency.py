"""add a native currency to loans

Revision ID: 0012
Revises: 0011
Create Date: 2026-08-12

Existing loans inherit their owner's preferred currency. VND is used only for
legacy owners who have not selected a preference; this repository's original
loan domain and schedules were VND-oriented.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0012"
down_revision: Union[str, None] = "0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute('ALTER TABLE "Loan" ADD COLUMN "currency" VARCHAR(3)')
    op.execute(
        """
        UPDATE "Loan"
        SET "currency" = COALESCE(
            (SELECT "preferredCurrency" FROM "User" WHERE "User"."id" = "Loan"."userId"),
            'VND'
        )
        """
    )
    op.execute('ALTER TABLE "Loan" ALTER COLUMN "currency" SET NOT NULL')
    op.create_check_constraint(
        "ck_loan_currency",
        "Loan",
        "currency IN ('USD', 'EUR', 'GBP', 'AUD', 'JPY', 'CNY', 'VND')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_loan_currency", "Loan", type_="check")
    op.execute('ALTER TABLE "Loan" DROP COLUMN "currency"')
