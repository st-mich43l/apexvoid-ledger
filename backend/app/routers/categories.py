from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..auth import require_password_changed
from ..cashflow import display_category_name, ensure_default_categories, normalize_category_name
from ..database import get_db
from ..models import Category, Transaction, User
from ..schemas import CategoryCreate, CategoryRead, CategoryUpdate

router = APIRouter(prefix="/api/categories", tags=["categories"])


def _serialize(category: Category) -> CategoryRead:
    return CategoryRead(
        id=category.id,
        name=category.name,
        type=category.category_type,
        icon=category.icon,
        is_active=category.is_active,
        created_at=category.created_at,
        updated_at=category.updated_at,
    )


def _get_or_404(db: Session, category_id: str, user_id: str) -> Category:
    category = (
        db.query(Category)
        .filter(Category.id == category_id, Category.user_id == user_id)
        .first()
    )
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")
    return category


def _ensure_unique(
    db: Session,
    user_id: str,
    category_type: str,
    normalized_name: str,
    exclude_id: str | None = None,
) -> None:
    query = db.query(Category).filter(
        Category.user_id == user_id,
        Category.category_type == category_type,
        Category.normalized_name == normalized_name,
    )
    if exclude_id is not None:
        query = query.filter(Category.id != exclude_id)
    if query.first() is not None:
        raise HTTPException(status_code=409, detail="A category with this name and type already exists")


@router.get("", response_model=list[CategoryRead])
def list_categories(
    category_type: Literal["income", "expense"] | None = Query(default=None, alias="type"),
    include_inactive: bool = Query(default=False, alias="includeInactive"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_password_changed),
):
    ensure_default_categories(db, current_user.id)
    query = db.query(Category).filter(Category.user_id == current_user.id)
    if category_type is not None:
        query = query.filter(Category.category_type == category_type)
    if not include_inactive:
        query = query.filter(Category.is_active.is_(True))
    categories = query.order_by(Category.category_type.asc(), Category.name.asc()).all()
    return [_serialize(category) for category in categories]


@router.post("", response_model=CategoryRead, status_code=201)
def create_category(
    payload: CategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_password_changed),
):
    ensure_default_categories(db, current_user.id)
    name = display_category_name(payload.name)
    normalized_name = normalize_category_name(name)
    _ensure_unique(db, current_user.id, payload.type, normalized_name)

    category = Category(
        user_id=current_user.id,
        name=name,
        normalized_name=normalized_name,
        category_type=payload.type,
        icon=payload.icon,
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return _serialize(category)


@router.put("/{category_id}", response_model=CategoryRead)
def update_category(
    category_id: str,
    payload: CategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_password_changed),
):
    category = _get_or_404(db, category_id, current_user.id)
    changes = payload.model_dump(exclude_unset=True)
    if any(changes.get(field) is None for field in ("name", "type", "is_active") if field in changes):
        raise HTTPException(status_code=422, detail="Category fields cannot be null")

    next_type = changes.get("type", category.category_type)
    next_name = display_category_name(changes.get("name", category.name))
    normalized_name = normalize_category_name(next_name)
    _ensure_unique(db, current_user.id, next_type, normalized_name, exclude_id=category.id)

    if next_type != category.category_type:
        has_transactions = db.query(Transaction).filter(Transaction.category_id == category.id).first()
        if has_transactions is not None:
            raise HTTPException(
                status_code=409,
                detail="A category with transactions cannot change type",
            )

    category.name = next_name
    category.normalized_name = normalized_name
    category.category_type = next_type
    if "icon" in changes:
        category.icon = changes["icon"]
    if "is_active" in changes:
        category.is_active = changes["is_active"]
    db.commit()
    db.refresh(category)
    return _serialize(category)


@router.delete("/{category_id}", status_code=204)
def deactivate_category(
    category_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_password_changed),
):
    category = _get_or_404(db, category_id, current_user.id)
    category.is_active = False
    db.commit()
