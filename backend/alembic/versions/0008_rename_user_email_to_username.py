"""rename user email to username

Login now uses a plain username, not an email address (the seeded
default admin already logs in as "admin", not an email — this makes
the column name match what it's actually been holding since 0007).

Revision ID: 0008
Revises: 0007
Create Date: 2026-08-12

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute('ALTER TABLE "User" RENAME COLUMN "email" TO "username"')
    op.execute('ALTER INDEX "User_email_key" RENAME TO "User_username_key"')


def downgrade() -> None:
    op.execute('ALTER INDEX "User_username_key" RENAME TO "User_email_key"')
    op.execute('ALTER TABLE "User" RENAME COLUMN "username" TO "email"')
