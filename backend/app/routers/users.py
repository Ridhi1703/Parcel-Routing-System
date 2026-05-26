from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import bcrypt
import uuid

from app.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate, UserResponse
from app.middleware.auth import require_role

router = APIRouter(prefix="/admin/users", tags=["admin-users"])

VALID_ROLES = {"user", "admin", "viewer"}


@router.get("", response_model=list[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_role("admin")),
):
    result = await db.execute(select(User).order_by(User.created_at))
    return result.scalars().all()


@router.post("", response_model=UserResponse, status_code=201)
async def create_user(
    body: UserCreate,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_role("admin")),
):
    existing = await db.execute(
        select(User).where(
            (User.username == body.username) | (User.email == body.email)
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Username or email already exists")

    if body.role not in VALID_ROLES:
        raise HTTPException(
            status_code=422, detail=f"Role must be one of: {', '.join(VALID_ROLES)}"
        )

    pw_hash = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
    user = User(
        id=uuid.uuid4(),
        username=body.username,
        email=body.email,
        password_hash=pw_hash,
        role=body.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: uuid.UUID,
    body: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current: dict = Depends(require_role("admin")),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if body.username is not None:
        clash = await db.execute(
            select(User).where(User.username == body.username, User.id != user_id)
        )
        if clash.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Username already taken")
        user.username = body.username

    if body.email is not None:
        clash = await db.execute(
            select(User).where(User.email == body.email, User.id != user_id)
        )
        if clash.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Email already taken")
        user.email = body.email

    if body.password is not None and body.password.strip():
        user.password_hash = bcrypt.hashpw(
            body.password.encode(), bcrypt.gensalt()
        ).decode()

    if body.role is not None:
        if body.role not in VALID_ROLES:
            raise HTTPException(
                status_code=422, detail=f"Role must be one of: {', '.join(VALID_ROLES)}"
            )
        if str(user.id) == current["sub"] and body.role != "admin":
            raise HTTPException(
                status_code=400, detail="Cannot change your own admin role"
            )
        user.role = body.role

    await db.commit()
    await db.refresh(user)
    return user


@router.patch("/{user_id}/role", response_model=UserResponse)
async def update_role(
    user_id: uuid.UUID,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current: dict = Depends(require_role("admin")),
):
    new_role = body.get("role")
    if new_role not in VALID_ROLES:
        raise HTTPException(
            status_code=422, detail=f"Role must be one of: {', '.join(VALID_ROLES)}"
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if str(user.id) == current["sub"] and new_role != "admin":
        raise HTTPException(status_code=400, detail="Cannot change your own admin role")

    user.role = new_role
    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=204)
async def delete_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current: dict = Depends(require_role("admin")),
):
    if str(user_id) == current["sub"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    await db.delete(user)
    await db.commit()
