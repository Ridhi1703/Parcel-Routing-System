import pytest
from fastapi import HTTPException
from app.routers.auth import create_access_token
from app.middleware.auth import decode_jwt


class TestJWT:
    def test_token_roundtrip(self):
        token = create_access_token(
            {"sub": "user-123", "username": "jsmith", "role": "user"}
        )
        payload = decode_jwt(token)

        assert payload["sub"] == "user-123"
        assert payload["username"] == "jsmith"
        assert payload["role"] == "user"

    def test_invalid_token_raises(self):
        with pytest.raises(HTTPException) as exc_info:
            decode_jwt("garbage.token.value")
        assert exc_info.value.status_code == 401
