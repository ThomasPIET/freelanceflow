from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app import config
from app.auth import AdminUser, AuthenticatedUser
from app.repository import PostgresUserRepository, UserRepository

app = FastAPI(title="FreelanceFlow users-service")


def get_repository() -> UserRepository:
    return PostgresUserRepository(config.database_url())


Repository = Annotated[UserRepository, Depends(get_repository)]


@app.exception_handler(StarletteHTTPException)
async def http_error_handler(_request: Request, exc: StarletteHTTPException) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"message": exc.detail})


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_request: Request, _exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"message": "Invalid request"})


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.delete("/users/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_me(user: AuthenticatedUser, repo: Repository) -> Response:
    if not repo.delete_user(user.id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/users")
def list_users(_admin: AdminUser, repo: Repository) -> list[dict]:
    return repo.list_users()


@app.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, _admin: AdminUser, repo: Repository) -> Response:
    target = repo.get_user(user_id)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if target["role"] == "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin accounts cannot be deleted")
    repo.delete_user(user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
