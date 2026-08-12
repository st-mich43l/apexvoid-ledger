"""Manual account bootstrap and recovery — not exposed over HTTP.

Registration is normally admin-gated (see routers/auth.py's POST
/api/auth/users) and the very first admin account is now auto-seeded by
migration 0007 (admin:admin, forced password change on first login). These
commands exist for recovery: creating an extra account without going
through the UI, or resetting a password if you're locked out.

Usage (inside the backend container or a local venv):

    python -m app.cli create-user
    python -m app.cli reset-password
"""

import getpass
import sys

from .auth import hash_password
from .database import SessionLocal
from .models import User


def _read_password() -> str:
    password = getpass.getpass("Password: ")
    if len(password) < 8:
        print("Password must be at least 8 characters.", file=sys.stderr)
        raise SystemExit(1)
    if len(password.encode("utf-8")) > 72:
        print("Password must be at most 72 bytes.", file=sys.stderr)
        raise SystemExit(1)

    confirm = getpass.getpass("Confirm password: ")
    if password != confirm:
        print("Passwords did not match.", file=sys.stderr)
        raise SystemExit(1)

    return password


def create_user() -> None:
    username = input("Username: ").strip().lower()
    if not username:
        print("Username cannot be empty.", file=sys.stderr)
        raise SystemExit(1)

    password = _read_password()
    is_admin = input("Admin? [y/N]: ").strip().lower() == "y"

    db = SessionLocal()
    try:
        if db.query(User).filter(User.username == username).first() is not None:
            print(f"A user named {username!r} already exists.", file=sys.stderr)
            raise SystemExit(1)

        # Chosen interactively by whoever's running this command, not a
        # handed-off temp password — no forced change needed.
        user = User(username=username, hashed_password=hash_password(password), is_admin=is_admin)
        db.add(user)
        db.commit()
        print(f"Created {'admin' if is_admin else 'user'} {username}.")
    finally:
        db.close()


def reset_password() -> None:
    username = input("Username: ").strip().lower()

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == username).first()
        if user is None:
            print(f"No user named {username!r}.", file=sys.stderr)
            raise SystemExit(1)

        password = _read_password()
        user.hashed_password = hash_password(password)
        user.must_change_password = False
        db.commit()
        print(f"Password reset for {username}.")
    finally:
        db.close()


COMMANDS = {"create-user": create_user, "reset-password": reset_password}


def main() -> None:
    if len(sys.argv) != 2 or sys.argv[1] not in COMMANDS:
        print(f"Usage: python -m app.cli {{{'|'.join(COMMANDS)}}}", file=sys.stderr)
        raise SystemExit(1)

    COMMANDS[sys.argv[1]]()


if __name__ == "__main__":
    main()
