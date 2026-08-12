"""seed default admin

Seeds a default admin:admin account, but ONLY when the User table is
completely empty — this must never re-seed once a real admin exists (that
would put a known-default-credential account back on a system someone has
already secured). must_change_password is set so the account is useless
for anything besides changing its own password until that happens.

Unlike prior migrations this isn't a static op.execute(...) SQL string:
computing the bcrypt hash requires actual Python, and a raw literal password
hash pasted into a migration file would be worse (unauditable, and bcrypt
hashes contain characters that are easy to mis-escape in a hand-written SQL
string). A parameterized query via the migration's own connection avoids
both problems.

Revision ID: 0007
Revises: 0006
Create Date: 2026-08-12

"""
import uuid
from typing import Sequence, Union

import bcrypt
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEFAULT_ADMIN_EMAIL = "admin"
DEFAULT_ADMIN_PASSWORD = "admin"  # noqa: S105 — intentional, forced change on first login


def upgrade() -> None:
    conn = op.get_bind()
    user_count = conn.execute(sa.text('SELECT COUNT(*) FROM "User"')).scalar()
    if user_count:
        return

    hashed = bcrypt.hashpw(DEFAULT_ADMIN_PASSWORD.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    conn.execute(
        sa.text(
            """
            INSERT INTO "User" ("id", "email", "hashedPassword", "isAdmin", "mustChangePassword")
            VALUES (:id, :email, :hashed, true, true)
            """
        ),
        {"id": str(uuid.uuid4()), "email": DEFAULT_ADMIN_EMAIL, "hashed": hashed},
    )


def downgrade() -> None:
    op.execute(f"DELETE FROM \"User\" WHERE \"email\" = '{DEFAULT_ADMIN_EMAIL}'")
