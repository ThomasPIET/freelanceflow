from dataclasses import dataclass
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app import config

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class CurrentUser:
    id: int
    role: str


def current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> CurrentUser:
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unauthorized: No token provided")
    try:
        payload = jwt.decode(credentials.credentials, config.jwt_secret(), algorithms=["HS256"])
    except jwt.InvalidTokenError as error:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "Unauthorized: Invalid or expired token"
        ) from error

    user_id = payload.get("id")
    if not isinstance(user_id, int):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unauthorized: Invalid or expired token")
    return CurrentUser(id=user_id, role=payload.get("role", "standard"))


def require_admin(user: Annotated[CurrentUser, Depends(current_user)]) -> CurrentUser:
    if user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden: admin only")
    return user


AuthenticatedUser = Annotated[CurrentUser, Depends(current_user)]
AdminUser = Annotated[CurrentUser, Depends(require_admin)]
