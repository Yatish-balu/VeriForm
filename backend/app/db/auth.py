"""Validate Supabase access tokens for the attendance API."""

from uuid import UUID

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase_auth.errors import AuthApiError, AuthError

from app.db.supabase_client import get_supabase

bearer = HTTPBearer(auto_error=False, bearerFormat="JWT")


def require_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> UUID:
    unauthorized = HTTPException(
        status_code=401,
        detail="A valid Supabase access token is required.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized

    try:
        response = get_supabase().auth.get_user(credentials.credentials)
    except AuthApiError as exc:
        if exc.status in (400, 401, 403, 404, 422):
            raise unauthorized from exc
        raise HTTPException(503, "Authentication service is unavailable.") from exc
    except AuthError as exc:
        raise HTTPException(503, "Authentication service is unavailable.") from exc

    if response is None or response.user is None:
        raise unauthorized
    return UUID(str(response.user.id))
