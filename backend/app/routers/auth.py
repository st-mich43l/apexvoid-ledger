from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..auth import get_current_user, hash_password, verify_password
from ..database import get_db
from ..models import User
from ..schemas import LoginRequest, UserCreate, UserRead

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=UserRead)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    email = payload.email.lower()
    user = db.query(User).filter(User.email == email).first()

    if user is None or not verify_password(payload.password, user.hashed_password):
        # Deliberately generic — don't reveal whether the email exists.
        raise HTTPException(status_code=401, detail="Invalid email or password")

    request.session["user_id"] = user.id
    return user


@router.post("/logout", status_code=204)
def logout(request: Request):
    request.session.clear()


@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/users", response_model=UserRead, status_code=201)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    email = payload.email.lower()
    if db.query(User).filter(User.email == email).first() is not None:
        raise HTTPException(status_code=409, detail="A user with this email already exists")

    user = User(email=email, hashed_password=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
