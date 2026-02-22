import time
import httpx
from mine_backend.config import settings

_jwks_cache = None
_jwks_expiration = 0

JWKS_TTL = 600  # 10 minutos


async def get_jwks():
    global _jwks_cache, _jwks_expiration

    now = time.time()

    if _jwks_cache and now < _jwks_expiration:
        return _jwks_cache

    jwks_url = (
        f"{settings.KEYCLOAK_URL}/realms/"
        f"{settings.KEYCLOAK_REALM}/protocol/openid-connect/certs"
    )

    async with httpx.AsyncClient() as client:
        response = await client.get(jwks_url)
        response.raise_for_status()
        _jwks_cache = response.json()
        _jwks_expiration = now + JWKS_TTL

    return _jwks_cache
