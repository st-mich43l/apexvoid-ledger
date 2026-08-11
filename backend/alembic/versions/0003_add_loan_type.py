"""add loan type

Revision ID: 0003
Revises: 0002
Create Date: 2026-08-11

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        'ALTER TABLE "Loan" ADD COLUMN IF NOT EXISTS "loanType" TEXT NOT NULL DEFAULT \'unsecured\''
    )


def downgrade() -> None:
    op.execute('ALTER TABLE "Loan" DROP COLUMN IF EXISTS "loanType"')
