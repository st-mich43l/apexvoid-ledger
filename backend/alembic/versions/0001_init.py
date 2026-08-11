"""init

Revision ID: 0001
Revises:
Create Date: 2026-08-11

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # IF NOT EXISTS: this table may already exist from the previous Prisma-based
    # backend with an identical schema — this migration adopts it rather than
    # requiring a destructive reset.
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS "Loan" (
            "id" TEXT PRIMARY KEY,
            "bankName" TEXT NOT NULL,
            "openDate" TIMESTAMP(3) NOT NULL,
            "disbursementAmount" DECIMAL(14,2) NOT NULL,
            "interestRatePerYear" DECIMAL(6,3) NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )


def downgrade() -> None:
    op.execute('DROP TABLE IF EXISTS "Loan"')
