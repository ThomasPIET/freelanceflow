from typing import Any, Protocol

import psycopg
from psycopg.rows import dict_row

USER_COLUMNS = "id, email, first_name, last_name, role, created_at"


class UserRepository(Protocol):
    def list_users(self) -> list[dict[str, Any]]: ...
    def get_user(self, user_id: int) -> dict[str, Any] | None: ...
    def delete_user(self, user_id: int) -> bool: ...


class PostgresUserRepository:
    def __init__(self, dsn: str):
        self._dsn = dsn

    def _connect(self) -> psycopg.Connection:
        return psycopg.connect(self._dsn, row_factory=dict_row)

    def list_users(self) -> list[dict[str, Any]]:
        with self._connect() as conn:
            return conn.execute(f"SELECT {USER_COLUMNS} FROM users ORDER BY id").fetchall()

    def get_user(self, user_id: int) -> dict[str, Any] | None:
        with self._connect() as conn:
            return conn.execute(
                f"SELECT {USER_COLUMNS} FROM users WHERE id = %s", (user_id,)
            ).fetchone()

    def delete_user(self, user_id: int) -> bool:
        with self._connect() as conn:
            return conn.execute("DELETE FROM users WHERE id = %s", (user_id,)).rowcount == 1
