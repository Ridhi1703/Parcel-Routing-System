from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from app.config import get_settings

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def decode_jwt(token: str) -> dict:
    try:
        payload = jwt.decode(
            token,
            get_settings().jwt_secret_key,
            algorithms=[get_settings().jwt_algorithm],
        )
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {e}"
        )


def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    return decode_jwt(token)


def require_role(*roles: str):
    def dependency(token: str = Depends(oauth2_scheme)) -> dict:
        payload = decode_jwt(token)
        if payload.get("role") not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return payload

    return dependency
