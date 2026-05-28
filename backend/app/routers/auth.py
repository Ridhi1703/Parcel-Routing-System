from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Response, Cookie
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import bcrypt
from jose import jwt

from app.database import get_db
from app.models.user import User
from app.schemas.user import LoginRequest, TokenResponse
from app.config import get_settings
from app.middleware.auth import decode_jwt

router = APIRouter(prefix="/auth", tags=["auth"])


def create_access_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + timedelta(
        hours=get_settings().jwt_expire_hours
    )
    return jwt.encode(
        payload, get_settings().jwt_secret_key, algorithm=get_settings().jwt_algorithm
    )


def create_refresh_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + timedelta(
        days=get_settings().jwt_refresh_expire_days
    )
    payload["type"] = "refresh"
    return jwt.encode(
        payload, get_settings().jwt_secret_key, algorithm=get_settings().jwt_algorithm
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(User.username == body.username)
    )
    user = result.scalar_one_or_none()

    print("USER:", user)
    print("HASH:", user.password_hash if user else None)

    try:
        valid = False

        if user:
            valid = bcrypt.checkpw(
                body.password.encode(),
                user.password_hash.encode()
            )

        print("VALID:", valid)

    except Exception as e:
        print("BCRYPT ERROR:", str(e))
        raise

    if not user or not valid:
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials"
        )

    token_data = {
        "sub": str(user.id),
        "username": user.username,
        "role": user.role,
    }

    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    response.set_cookie(
        "refresh_token",
        refresh_token,
        httponly=True,
        max_age=60 * 60 * 24 * get_settings().jwt_refresh_expire_days,
        samesite="lax",
    )

    return TokenResponse(access_token=access_token)




@router.post("/refresh", response_model=TokenResponse)
async def refresh(refresh_token: str = Cookie(None)):
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token")

    payload = decode_jwt(refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    token_data = {
        "sub": payload["sub"],
        "username": payload["username"],
        "role": payload["role"],
    }
    return TokenResponse(access_token=create_access_token(token_data))


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("refresh_token")
    return {"detail": "Logged out"}
