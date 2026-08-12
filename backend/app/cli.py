"""One-time/manual account bootstrap and management.

Not exposed over HTTP — registration is admin-gated (see routers/auth.py's
POST /api/auth/users), so the very first account has to come from somewhere
that doesn't require an existing session. This is that somewhere.

Usage (inside the backend container or a local venv):

    python -m app.cli create-user
"""

import getpass
import sys

from .auth import hash_password
from .database import SessionLocal
from .models import User


def create_user() -> None:
    email = input("Email: ").strip().lower()
    if not email:
        print("Email cannot be empty.", file=sys.stderr)
        raise SystemExit(1)

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

    db = SessionLocal()
    try:
        if db.query(User).filter(User.email == email).first() is not None:
            print(f"A user with email {email!r} already exists.", file=sys.stderr)
            raise SystemExit(1)

        user = User(email=email, hashed_password=hash_password(password))
        db.add(user)
        db.commit()
        print(f"Created user {email}.")
    finally:
        db.close()


COMMANDS = {"create-user": create_user}


def main() -> None:
    if len(sys.argv) != 2 or sys.argv[1] not in COMMANDS:
        print(f"Usage: python -m app.cli {{{'|'.join(COMMANDS)}}}", file=sys.stderr)
        raise SystemExit(1)

    COMMANDS[sys.argv[1]]()


if __name__ == "__main__":
    main()
