"""Microsoft Entra workforce provisioning for delivery agents."""
import secrets
import string
from urllib.parse import quote

import httpx


class EntraProvisioningError(RuntimeError):
    pass


def generate_temporary_password(length: int = 20) -> str:
    """Generate a strong password that satisfies Entra's complexity rules."""
    alphabet = string.ascii_letters + string.digits + "!@#$%*-_"
    required = [
        secrets.choice(string.ascii_uppercase),
        secrets.choice(string.ascii_lowercase),
        secrets.choice(string.digits),
        secrets.choice("!@#$%*-_"),
    ]
    chars = required + [secrets.choice(alphabet) for _ in range(length - len(required))]
    secrets.SystemRandom().shuffle(chars)
    return "".join(chars)


class EntraAgentProvisioner:
    def __init__(
        self,
        tenant_id: str,
        client_id: str,
        client_secret: str,
        user_domain: str,
        resource_service_principal_id: str,
        agent_app_role_id: str,
    ):
        self.tenant_id = tenant_id
        self.client_id = client_id
        self.client_secret = client_secret
        self.user_domain = user_domain
        self.resource_service_principal_id = resource_service_principal_id
        self.agent_app_role_id = agent_app_role_id

    @property
    def configured(self) -> bool:
        return all((
            self.tenant_id,
            self.client_id,
            self.client_secret,
            self.user_domain,
            self.resource_service_principal_id,
            self.agent_app_role_id,
        ))

    async def _token(self) -> str:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(
                f"https://login.microsoftonline.com/{quote(self.tenant_id)}/oauth2/v2.0/token",
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "scope": "https://graph.microsoft.com/.default",
                    "grant_type": "client_credentials",
                },
            )
        if response.is_error:
            raise EntraProvisioningError("Microsoft Entra provisioning authentication failed")
        return response.json()["access_token"]

    async def _request(self, method: str, path: str, *, json=None, expected=(200, 201, 204)):
        token = await self._token()
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.request(
                method,
                f"https://graph.microsoft.com/v1.0{path}",
                headers={"Authorization": f"Bearer {token}"},
                json=json,
            )
        if response.status_code not in expected:
            try:
                graph_message = response.json().get("error", {}).get("message")
            except Exception:
                graph_message = None
            raise EntraProvisioningError(graph_message or "Microsoft Entra provisioning failed")
        return response.json() if response.content else None

    def username_for_phone(self, phone: str) -> str:
        return f"agent.{phone}@{self.user_domain}"

    async def create_agent(self, name: str, phone: str) -> dict:
        username = self.username_for_phone(phone)
        temporary_password = generate_temporary_password()
        user = await self._request("POST", "/users", json={
            "accountEnabled": True,
            "displayName": name,
            "mailNickname": f"agent{phone}",
            "mobilePhone": f"+91{phone}",
            "userPrincipalName": username,
            "passwordProfile": {
                "password": temporary_password,
                "forceChangePasswordNextSignIn": True,
            },
        })
        try:
            assignment = await self._request(
                "POST",
                f"/users/{quote(user['id'])}/appRoleAssignments",
                json={
                    "principalId": user["id"],
                    "resourceId": self.resource_service_principal_id,
                    "appRoleId": self.agent_app_role_id,
                },
            )
        except Exception:
            # Do not leave a sign-in-enabled orphan when role assignment fails.
            await self._request("PATCH", f"/users/{quote(user['id'])}", json={"accountEnabled": False})
            raise
        return {
            "object_id": user["id"],
            "username": username,
            "temporary_password": temporary_password,
            "app_role_assignment_id": assignment["id"],
        }

    async def update_agent(self, object_id: str, name: str, phone: str, active: bool) -> None:
        await self._request("PATCH", f"/users/{quote(object_id)}", json={
            "accountEnabled": active,
            "displayName": name,
            "mobilePhone": f"+91{phone}",
        })

    async def revoke_role(self, object_id: str, assignment_id: str) -> None:
        if assignment_id:
            await self._request(
                "DELETE",
                f"/users/{quote(object_id)}/appRoleAssignments/{quote(assignment_id)}",
            )
        await self._request("PATCH", f"/users/{quote(object_id)}", json={"accountEnabled": False})
