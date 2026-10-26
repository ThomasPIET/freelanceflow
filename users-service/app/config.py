import os


def jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def database_url() -> str:
    return os.environ["DATABASE_URL"]
