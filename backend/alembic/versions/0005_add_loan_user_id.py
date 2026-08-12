"""add loan user_id (nullable)

Adds the userId column and its FK constraint but does NOT backfill or
enforce NOT NULL yet — existing "Loan" rows have no owner until at least one
User exists. See 0006, which must not run until the CLI bootstrap
(`python -m app.cli create-user`) has created that first user.

Revision ID: 0005
Revises: 0004
Create Date: 2026-08-11

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute('ALTER TABLE "Loan" ADD COLUMN IF NOT EXISTS "userId" TEXT')

    # Postgres has no `ADD CONSTRAINT IF NOT EXISTS` — this guard is the
    # idempotent equivalent. A NULL userId is legal and not checked against
    # "User" until 0006 backfills and enforces NOT NULL.
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'Loan_userId_fkey'
            ) THEN
                ALTER TABLE "Loan"
                    ADD CONSTRAINT "Loan_userId_fkey"
                    FOREIGN KEY ("userId") REFERENCES "User" ("id");
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    op.execute('ALTER TABLE "Loan" DROP CONSTRAINT IF EXISTS "Loan_userId_fkey"')
    op.execute('ALTER TABLE "Loan" DROP COLUMN IF EXISTS "userId"')
