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


def test_admin_can_reset_a_non_admin_password(
  auth_client: TestClient,
  client_factory,
  db_session,
  other_user,
  user,
):
  user.is_admin = True
  db_session.commit()

  response = auth_client.post(
    f"/api/auth/users/{other_user.id}/reset-password",
    json={"newPassword": "temporary-reset-123"},
  )

  assert response.status_code == 200, response.text
  assert response.json()["mustChangePassword"] is True

  fresh_client = client_factory()
  assert fresh_client.post(
    "/api/auth/login",
    json={"username": other_user.username, "password": DEFAULT_PASSWORD},
  ).status_code == 401
  assert fresh_client.post(
    "/api/auth/login",
    json={"username": other_user.username, "password": "temporary-reset-123"},
  ).status_code == 200


def test_reset_password_rejects_non_admin_and_admin_targets(
  auth_client: TestClient,
  db_session,
  other_user,
  user,
):
  non_admin = auth_client.post(
    f"/api/auth/users/{other_user.id}/reset-password",
    json={"newPassword": "temporary-reset-123"},
  )
  assert non_admin.status_code == 403

  user.is_admin = True
  other_user.is_admin = True
  db_session.commit()
  admin_target = auth_client.post(
    f"/api/auth/users/{other_user.id}/reset-password",
    json={"newPassword": "temporary-reset-123"},
  )
  assert admin_target.status_code == 403
  assert admin_target.json()["detail"] == "Admin passwords can only be changed by their owner"
