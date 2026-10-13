from __future__ import annotations

import hashlib
import json
import uuid
from typing import Any

import httpx
from fastapi import HTTPException

from app.config import settings


class SupabaseGateway:
    def __init__(self) -> None:
        self.base = settings.supabase_url.rstrip("/")
        self.rest = f"{self.base}/rest/v1"
        self.auth = f"{self.base}/auth/v1"
        self.storage = f"{self.base}/storage/v1"

    def _headers(self, token: str | None = None, service: bool = False) -> dict[str, str]:
        key = settings.privileged_api_key if service else settings.public_api_key
        headers = {"apikey": key}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        elif service and not key.startswith("sb_secret_"):
            # Legacy service_role keys are JWTs and act as both API key and bearer.
            headers["Authorization"] = f"Bearer {key}"
        elif not service and key.startswith("eyJ"):
            # Legacy anon keys are JWTs; modern publishable keys belong in apikey only.
            headers["Authorization"] = f"Bearer {key}"
        if token:
            headers["x-client-info"] = "meiproof-backend"
        return headers

    async def auth_user(self, token: str) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(f"{self.auth}/user", headers=self._headers(token))
        if response.status_code != 200:
            raise HTTPException(401, "Invalid or expired bearer token")
        return response.json()

    async def request(self, method: str, path: str, *, token: str | None = None, service: bool = True, json_body: Any = None, params: dict[str, str] | None = None, content: bytes | None = None, headers: dict[str, str] | None = None) -> Any:
        request_headers = self._headers(token, service=service)
        if json_body is not None:
            request_headers["Content-Type"] = "application/json"
            request_headers["Prefer"] = "return=representation"
        if headers:
            request_headers.update(headers)
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.request(method, f"{self.base}{path}" if path.startswith("/") else path, headers=request_headers, params=params, json=json_body, content=content)
        if response.status_code >= 400:
            detail = "Supabase request failed"
            try:
                payload = response.json()
                detail = payload.get("message") or payload.get("hint") or payload.get("error") or detail
            except ValueError:
                pass
            raise HTTPException(response.status_code if response.status_code < 500 else 502, detail)
        if not response.content:
            return None
        return response.json()

    async def table(self, table: str, *, token: str | None = None, select: str = "*", filters: dict[str, str] | None = None, order: str | None = None, limit: int = 100) -> list[dict[str, Any]]:
        params = {"select": select, "limit": str(limit)}
        if order:
            params["order"] = order
        for key, value in (filters or {}).items():
            params[key] = value
        return await self.request("GET", f"{self.rest}/{table}", token=token, service=token is None, params=params)

    async def insert(self, table: str, body: dict[str, Any], *, token: str | None = None, service: bool = True) -> list[dict[str, Any]]:
        return await self.request("POST", f"{self.rest}/{table}", token=token, service=service, json_body=body)

    async def rpc(self, function: str, body: dict[str, Any], token: str) -> Any:
        return await self.request("POST", f"{self.rest}/rpc/{function}", token=token, service=False, json_body=body)

    async def membership_roles(self, user_id: str, token: str) -> list[dict[str, Any]]:
        return await self.table("organization_memberships", token=token, select="organization_id,role", filters={"user_id": f"eq.{user_id}"})

    async def claim(self, claim_id: uuid.UUID, token: str) -> dict[str, Any]:
        rows = await self.table("claims", token=token, filters={"id": f"eq.{claim_id}"}, limit=1)
        if not rows:
            raise HTTPException(404, "Claim not found")
        return rows[0]

    async def storage_upload(self, path: str, content: bytes, mime_type: str, token: str) -> None:
        await self.request("POST", f"{self.storage}/object/{settings.storage_bucket}/{path}", token=token, service=False, content=content, headers={"Content-Type": mime_type, "x-upsert": "false"})

    async def storage_download(self, path: str) -> bytes:
        request_headers = self._headers(service=True)
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(f"{self.storage}/object/{settings.storage_bucket}/{path}", headers=request_headers)
        if response.status_code >= 400:
            raise HTTPException(502, "Private evidence could not be read by the extraction service")
        return response.content

    async def storage_signed_url(self, path: str, token: str, expires_in: int = 300) -> str:
        result = await self.request("POST", f"{self.storage}/object/sign/{settings.storage_bucket}/{path}", token=token, service=False, json_body={"expiresIn": expires_in})
        return result.get("signedURL") or result.get("signedUrl") or result.get("signed_url")

    @staticmethod
    def document_hash(content: bytes) -> str:
        return hashlib.sha256(content).hexdigest()

    @staticmethod
    def safe_manifest(payload: dict[str, Any]) -> str:
        safe = {k: v for k, v in payload.items() if k not in {"bytes", "original_filename", "tax_id", "storage_path"}}
        return hashlib.sha256(json.dumps(safe, sort_keys=True, separators=(",", ":")).encode()).hexdigest()

gateway = SupabaseGateway()
