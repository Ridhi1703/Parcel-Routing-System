from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import bcrypt

from app.database import get_db
from app.models.user import User
from app.schemas.user import UserUpdate, UserResponse
from app.middleware.auth import require_role

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserResponse)
async def get_me(
    db: AsyncSession = Depends(get_db),
    current: dict = Depends(require_role("user", "admin", "viewer")),
):
    result = await db.execute(select(User).where(User.id == current["sub"]))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.patch("/me", response_model=UserResponse)
async def update_me(
    body: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current: dict = Depends(require_role("user", "admin", "viewer")),
):
    result = await db.execute(select(User).where(User.id == current["sub"]))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if body.username is not None:
        clash = await db.execute(
            select(User).where(User.username == body.username, User.id != user.id)
        )
        if clash.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Username already taken")
        user.username = body.username

    if body.email is not None:
        clash = await db.execute(
            select(User).where(User.email == body.email, User.id != user.id)
        )
        if clash.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Email already taken")
        user.email = body.email

    if body.password is not None and body.password.strip():
        if not body.current_password:
            raise HTTPException(
                status_code=400,
                detail="current_password is required to change password",
            )
        if not bcrypt.checkpw(
            body.current_password.encode(), user.password_hash.encode()
        ):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        user.password_hash = bcrypt.hashpw(
            body.password.encode(), bcrypt.gensalt()
        ).decode()

    # role cannot be changed via this endpoint
    await db.commit()
    await db.refresh(user)
    return user
