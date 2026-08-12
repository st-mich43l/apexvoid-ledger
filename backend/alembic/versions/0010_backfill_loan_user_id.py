"""backfill loan user_id and enforce NOT NULL

Assigns every currently-unowned "Loan" row (userId IS NULL — i.e. every
loan created before per-user scoping existed) to whichever user was
created first, then flips the column to NOT NULL so every future loan
must have an owner.

This is safe to run unconditionally: 0007 guarantees at least one User row
(the seeded admin, or a real account that replaced it) exists by the time
this migration runs. If that guarantee were ever violated, the UPDATE
becomes a no-op and the SET NOT NULL fails loudly — since the backend's
Dockerfile CMD is `alembic upgrade head && uvicorn ...`, that's a
crash-looping container, not silently-orphaned data.

Revision ID: 0010
Revises: 0009
Create Date: 2026-08-12

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE "Loan"
        SET "userId" = (SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1)
        WHERE "userId" IS NULL
        """
    )
    op.execute('ALTER TABLE "Loan" ALTER COLUMN "userId" SET NOT NULL')


def downgrade() -> None:
    op.execute('ALTER TABLE "Loan" ALTER COLUMN "userId" DROP NOT NULL')
