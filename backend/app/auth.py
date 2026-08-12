import bcrypt
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .database import get_db
from .models import User


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    user = db.get(User, user_id)
    if user is None:
        # Session refers to a user that no longer exists.
        request.session.clear()
        raise HTTPException(status_code=401, detail="Not authenticated")

    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def require_password_changed(current_user: User = Depends(get_current_user)) -> User:
    """Blocks routes (loans, etc.) until a forced password change is done.

    Deliberately NOT applied to /me, /logout, or /change-password itself —
    those must stay reachable while must_change_password is set, or the user
    would have no way to satisfy the requirement.
    """
    if current_user.must_change_password:
        raise HTTPException(status_code=403, detail="Password change required")
    return current_user
