from fastapi.testclient import TestClient

from .conftest import DEFAULT_PASSWORD


def test_change_password_updates_credentials(
  auth_client: TestClient,
  client_factory,
  user,
):
  response = auth_client.post(
    "/api/auth/change-password",
    json={"currentPassword": DEFAULT_PASSWORD, "newPassword": "new-secret-123"},
  )

  assert response.status_code == 200, response.text
  assert response.json()["mustChangePassword"] is False

  fresh_client = client_factory()
  assert fresh_client.post(
    "/api/auth/login",
    json={"username": user.username, "password": DEFAULT_PASSWORD},
  ).status_code == 401
  assert fresh_client.post(
    "/api/auth/login",
    json={"username": user.username, "password": "new-secret-123"},
  ).status_code == 200


def test_change_password_rejects_wrong_current_password(auth_client: TestClient):
  response = auth_client.post(
    "/api/auth/change-password",
    json={"currentPassword": "wrong-password", "newPassword": "new-secret-123"},
  )

  assert response.status_code == 401
  assert response.json()["detail"] == "Current password is incorrect"


def test_change_password_requires_authentication(client: TestClient):
  response = client.post(
    "/api/auth/change-password",
    json={"currentPassword": DEFAULT_PASSWORD, "newPassword": "new-secret-123"},
  )

  assert response.status_code == 401
