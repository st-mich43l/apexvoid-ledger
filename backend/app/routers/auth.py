from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..auth import get_current_user, hash_password, require_admin, verify_password
from ..database import get_db
from ..models import Category, Loan, Transaction, User
from ..schemas import ChangePasswordRequest, LoginRequest, SetCurrencyRequest, UserCreate, UserRead

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=UserRead)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
  username = payload.username.lower()
  user = db.query(User).filter(User.username == username).first()

  if user is None or not verify_password(payload.password, user.hashed_password):
    # Deliberately generic — don't reveal whether the username exists.
    raise HTTPException(status_code=401, detail="Invalid username or password")

  request.session["user_id"] = user.id
  return user


@router.post("/logout", status_code=204)
def logout(request: Request):
  request.session.clear()


@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)):
  return current_user


@router.post("/change-password", response_model=UserRead)
def change_password(
  payload: ChangePasswordRequest,
  db: Session = Depends(get_db),
  current_user: User = Depends(get_current_user),
):
  if not verify_password(payload.current_password, current_user.hashed_password):
    raise HTTPException(status_code=401, detail="Current password is incorrect")

  current_user.hashed_password = hash_password(payload.new_password)
  current_user.must_change_password = False
  db.commit()
  db.refresh(current_user)
  return current_user


@router.patch("/currency", response_model=UserRead)
def set_currency(
  payload: SetCurrencyRequest,
  db: Session = Depends(get_db),
  current_user: User = Depends(get_current_user),
):
  current_user.preferred_currency = payload.currency
  db.commit()
  db.refresh(current_user)
  return current_user


@router.get("/users", response_model=list[UserRead])
def list_users(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
  return db.query(User).order_by(User.created_at.asc()).all()


@router.post("/users", response_model=UserRead, status_code=201)
def create_user(
  payload: UserCreate,
  db: Session = Depends(get_db),
  _admin: User = Depends(require_admin),
):
  username = payload.username.lower()
  if db.query(User).filter(User.username == username).first() is not None:
    raise HTTPException(status_code=409, detail="A user with this username already exists")

  user = User(
    username=username,
    hashed_password=hash_password(payload.password),
    is_admin=payload.is_admin,
    # Admin-created accounts always start with a forced change — the
    # admin knows this password, the invitee shouldn't keep using it.
    must_change_password=True,
  )
  db.add(user)
  db.commit()
  db.refresh(user)
  return user


@router.delete("/users/{user_id}", status_code=204)
def delete_user(
  user_id: str,
  db: Session = Depends(get_db),
  admin: User = Depends(require_admin),
):
  if user_id == admin.id:
    raise HTTPException(status_code=409, detail="You cannot delete your own account")

  user = db.get(User, user_id)
  if user is None:
    raise HTTPException(status_code=404, detail="User not found")

  if user.is_admin:
    remaining_admins = db.query(User).filter(User.is_admin.is_(True), User.id != user_id).count()
    if remaining_admins == 0:
      raise HTTPException(status_code=409, detail="Cannot delete the last remaining admin")

  if db.query(Loan).filter(Loan.user_id == user_id).count() > 0:
    raise HTTPException(
      status_code=409, detail="Cannot delete a user who still owns loans"
    )

  if db.query(Transaction).filter(Transaction.user_id == user_id).count() > 0:
    raise HTTPException(
      status_code=409, detail="Cannot delete a user who still owns transactions"
    )

  # Categories are lazily seeded on first cash-flow access. They carry no
  # financial history by themselves, so clean them up when the account is
  # otherwise deletable instead of making defaults permanently block it.
  db.query(Category).filter(Category.user_id == user_id).delete()

  db.delete(user)
  db.commit()
