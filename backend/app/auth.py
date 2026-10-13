from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.supabase_gateway import gateway

bearer = HTTPBearer(auto_error=False)

@dataclass(frozen=True)
class Principal:
    user_id: str
    email: str | None
    roles: tuple[dict, ...]

    def has_role(self, role: str, organization_id: str | None = None) -> bool:
        return any(item["role"] == role and (organization_id is None or item["organization_id"] == organization_id) for item in self.roles)

async def current_principal(credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]) -> Principal:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(401, "Bearer token required")
    user = await gateway.auth_user(credentials.credentials)
    roles = await gateway.membership_roles(user["id"], credentials.credentials)
    if not roles:
        raise HTTPException(403, "Workspace membership is required")
    return Principal(user_id=user["id"], email=user.get("email"), roles=tuple(roles))

def require_role(role: str):
    async def dependency(principal: Annotated[Principal, Depends(current_principal)]) -> Principal:
        if not principal.has_role(role):
            raise HTTPException(403, f"{role} role required")
        return principal
    return dependency

def token_from_credentials(credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]) -> str:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(401, "Bearer token required")
    return credentials.credentials
