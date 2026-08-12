"""add users

Revision ID: 0004
Revises: 0003
Create Date: 2026-08-11

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS "User" (
            "id" TEXT PRIMARY KEY,
            "email" TEXT NOT NULL,
            "hashedPassword" TEXT NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    op.execute('CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User" ("email")')


def downgrade() -> None:
    op.execute('DROP TABLE IF EXISTS "User"')
