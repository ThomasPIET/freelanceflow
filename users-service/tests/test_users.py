from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi.testclient import TestClient

from app.main import app, get_repository

SECRET = "test-secret-at-least-32-bytes-long!!"

USERS = [
    {
        "id": 1,
        "email": "admin@test.com",
        "first_name": "Ada",
        "last_name": "Min",
        "role": "admin",
        "created_at": "2026-10-01T00:00:00",
    },
    {
        "id": 2,
        "email": "bob@test.com",
        "first_name": "Bob",
        "last_name": "Std",
        "role": "standard",
        "created_at": "2026-10-02T00:00:00",
    },
    {
        "id": 3,
        "email": "root@test.com",
        "first_name": "Root",
        "last_name": "Admin",
        "role": "admin",
        "created_at": "2026-10-03T00:00:00",
    },
]


class FakeRepository:
    def __init__(self, users):
        self.users = {user["id"]: dict(user) for user in users}

    def list_users(self):
        return [self.users[user_id] for user_id in sorted(self.users)]

    def get_user(self, user_id):
        return self.users.get(user_id)

    def delete_user(self, user_id):
        return self.users.pop(user_id, None) is not None


@pytest.fixture
def repo(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", SECRET)
    fake = FakeRepository(USERS)
    app.dependency_overrides[get_repository] = lambda: fake
    yield fake
    app.dependency_overrides.clear()


@pytest.fixture
def client(repo):
    return TestClient(app)


def bearer(user_id, role=None, secret=SECRET, expires_in=timedelta(hours=1)):
    payload = {"id": user_id, "email": "x@test.com", "exp": datetime.now(UTC) + expires_in}
    if role is not None:
        payload["role"] = role
    return {"Authorization": f"Bearer {jwt.encode(payload, secret, algorithm='HS256')}"}


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


# ── DELETE /users/me ─────────────────────────────────
def test_delete_me_removes_own_account(client, repo):
    response = client.delete("/users/me", headers=bearer(2, "standard"))
    assert response.status_code == 204
    assert 2 not in repo.users


def test_admin_can_delete_own_account(client, repo):
    response = client.delete("/users/me", headers=bearer(3, "admin"))
    assert response.status_code == 204
    assert 3 not in repo.users


def test_delete_me_unknown_account_returns_404(client):
    response = client.delete("/users/me", headers=bearer(42, "standard"))
    assert response.status_code == 404
    assert response.json() == {"message": "User not found"}


def test_missing_token_returns_401(client):
    response = client.delete("/users/me")
    assert response.status_code == 401
    assert "message" in response.json()


def test_basic_auth_header_returns_401(client):
    response = client.delete("/users/me", headers={"Authorization": "Basic Zm9vOmJhcg=="})
    assert response.status_code == 401


def test_wrong_signature_returns_401(client, repo):
    headers = bearer(2, "standard", secret="another-secret-also-32-bytes-long!!")
    response = client.delete("/users/me", headers=headers)
    assert response.status_code == 401
    assert 2 in repo.users


def test_expired_token_returns_401(client):
    headers = bearer(2, "standard", expires_in=timedelta(hours=-1))
    response = client.delete("/users/me", headers=headers)
    assert response.status_code == 401


# ── GET /users ───────────────────────────────────────
def test_admin_lists_users_sorted(client):
    response = client.get("/users", headers=bearer(1, "admin"))
    assert response.status_code == 200
    assert [user["id"] for user in response.json()] == [1, 2, 3]
    assert response.json()[1]["role"] == "standard"


def test_standard_cannot_list_users(client):
    response = client.get("/users", headers=bearer(2, "standard"))
    assert response.status_code == 403
    assert "message" in response.json()


def test_token_without_role_is_standard(client):
    response = client.get("/users", headers=bearer(1))
    assert response.status_code == 403


# ── DELETE /users/{id} ───────────────────────────────
def test_admin_deletes_standard_account(client, repo):
    response = client.delete("/users/2", headers=bearer(1, "admin"))
    assert response.status_code == 204
    assert 2 not in repo.users


def test_admin_cannot_delete_admin_account(client, repo):
    response = client.delete("/users/3", headers=bearer(1, "admin"))
    assert response.status_code == 403
    assert 3 in repo.users


def test_admin_delete_unknown_account_returns_404(client):
    response = client.delete("/users/99", headers=bearer(1, "admin"))
    assert response.status_code == 404


def test_standard_cannot_delete_other_account(client, repo):
    response = client.delete("/users/1", headers=bearer(2, "standard"))
    assert response.status_code == 403
    assert 1 in repo.users


def test_non_integer_id_returns_422_with_message(client):
    response = client.delete("/users/abc", headers=bearer(1, "admin"))
    assert response.status_code == 422
    assert "message" in response.json()


def test_unexpected_error_returns_500_with_message(repo, monkeypatch):
    def boom(_user_id):
        raise RuntimeError("database exploded")

    monkeypatch.setattr(repo, "delete_user", boom)
    client = TestClient(app, raise_server_exceptions=False)

    response = client.delete("/users/me", headers=bearer(2, "standard"))

    assert response.status_code == 500
    assert response.json() == {"message": "Internal Server Error"}
