import re

import pytest

from entra_provisioning import EntraAgentProvisioner, generate_temporary_password


def make_provisioner():
    return EntraAgentProvisioner("tenant", "client", "secret", "ramsboutique.com", "resource", "role")


def test_temporary_password_meets_complexity():
    password = generate_temporary_password()
    assert len(password) == 20
    assert re.search(r"[A-Z]", password)
    assert re.search(r"[a-z]", password)
    assert re.search(r"\d", password)
    assert re.search(r"[!@#$%*\-_]", password)


@pytest.mark.asyncio
async def test_create_agent_creates_user_and_assigns_role(monkeypatch):
    provisioner = make_provisioner()
    calls = []

    async def fake_request(method, path, *, json=None, expected=(200, 201, 204)):
        calls.append((method, path, json))
        return {"id": "user-object-id"} if path == "/users" else {"id": "assignment-id"}

    monkeypatch.setattr(provisioner, "_request", fake_request)
    result = await provisioner.create_agent("Test Agent", "9876543210")

    assert result["username"] == "agent.9876543210@ramsboutique.com"
    assert result["object_id"] == "user-object-id"
    assert result["app_role_assignment_id"] == "assignment-id"
    assert calls[0][2]["mobilePhone"] == "+919876543210"
    assert calls[0][2]["passwordProfile"]["forceChangePasswordNextSignIn"] is True
    assert calls[1][2] == {"principalId": "user-object-id", "resourceId": "resource", "appRoleId": "role"}


@pytest.mark.asyncio
async def test_update_agent_syncs_status_name_and_phone(monkeypatch):
    provisioner = make_provisioner()
    calls = []

    async def fake_request(method, path, *, json=None, expected=(200, 201, 204)):
        calls.append((method, path, json))

    monkeypatch.setattr(provisioner, "_request", fake_request)
    await provisioner.update_agent("object-id", "Updated Agent", "9123456789", False)
    assert calls == [("PATCH", "/users/object-id", {
        "accountEnabled": False, "displayName": "Updated Agent", "mobilePhone": "+919123456789"
    })]
