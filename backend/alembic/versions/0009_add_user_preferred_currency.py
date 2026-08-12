"""add user preferred currency

Nullable, no default: NULL means "hasn't chosen yet" and is what
RequireAuth (frontend) uses to force the /select-currency gate on
first login, the same way mustChangePassword forces /change-password.

Revision ID: 0009
Revises: 0008
Create Date: 2026-08-12

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "preferredCurrency" TEXT')


def downgrade() -> None:
    op.execute('ALTER TABLE "User" DROP COLUMN IF EXISTS "preferredCurrency"')
