"""add user admin fields

Revision ID: 0006
Revises: 0005
Create Date: 2026-08-12

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isAdmin" BOOLEAN NOT NULL DEFAULT false')
    op.execute(
        'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false'
    )


def downgrade() -> None:
    op.execute('ALTER TABLE "User" DROP COLUMN IF EXISTS "mustChangePassword"')
    op.execute('ALTER TABLE "User" DROP COLUMN IF EXISTS "isAdmin"')
