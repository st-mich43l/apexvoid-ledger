"""add loan duration

Revision ID: 0002
Revises: 0001
Create Date: 2026-08-11

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        'ALTER TABLE "Loan" ADD COLUMN IF NOT EXISTS "durationMonths" INTEGER NOT NULL DEFAULT 12'
    )


def downgrade() -> None:
    op.execute('ALTER TABLE "Loan" DROP COLUMN IF EXISTS "durationMonths"')
