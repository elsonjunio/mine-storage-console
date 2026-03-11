import json
from typing import Any, Callable

from fastapi.encoders import jsonable_encoder

from mine_backend.core.redis import redis

CACHE_TTL = 30  # seconds


class CacheManager:
    """
    Cache layer backed by Redis with a 30 s TTL.

    Scoping rules
    -------------
    - Admin users share a **global** namespace  → ``cache:global:{key}``
    - Non-admin users get an **isolated** namespace → ``cache:user:{uid}:{key}``

    Redis fallback
    --------------
    When Redis is not configured (``redis is None``) every operation is a
    no-op: reads call the service directly and writes skip invalidation.
    """

    def __init__(self, user_id: str, is_admin: bool) -> None:
        self.user_id = user_id
        self._is_admin = is_admin

    # ── Key helpers ───────────────────────────────────────────────────────────

    def _build_key(self, resource_key: str) -> str:
        if self._is_admin:
            return f'cache:global:{resource_key}'
        return f'cache:user:{self.user_id}:{resource_key}'

    # ── Read ──────────────────────────────────────────────────────────────────

    async def get_or_set(
        self,
        resource_key: str,
        fn: Callable,
        *args: Any,
        **kwargs: Any,
    ) -> Any:
        """Return the cached value for *resource_key*; on a miss call *fn* and
        store the result.  The callable must be **synchronous**.

        When Redis is unavailable the callable is executed directly and the
        result is returned without caching.
        """
        if redis is None:
            return fn(*args, **kwargs)

        full_key = self._build_key(resource_key)

        cached = await redis.get(full_key)
        if cached is not None:
            return json.loads(cached)

        result = fn(*args, **kwargs)
        serializable = jsonable_encoder(result)
        await redis.setex(full_key, CACHE_TTL, json.dumps(serializable))
        return serializable

    # ── Invalidation ──────────────────────────────────────────────────────────

    async def invalidate(self, *resource_keys: str) -> None:
        """Delete specific cache entries.

        Both the global namespace and the current user's namespace are cleared
        so that writes by non-admin users also bust the shared admin cache.
        """
        if redis is None:
            return

        keys: list[str] = []
        for rk in resource_keys:
            keys.append(f'cache:global:{rk}')
            keys.append(f'cache:user:{self.user_id}:{rk}')

        if keys:
            await redis.delete(*keys)

    async def invalidate_prefix(self, *prefixes: str) -> None:
        """Delete all cache entries whose resource key starts with any of the
        given prefixes (scanned across both global and user namespaces).
        """
        if redis is None:
            return

        patterns: list[str] = []
        for prefix in prefixes:
            patterns.append(f'cache:global:{prefix}*')
            patterns.append(f'cache:user:{self.user_id}:{prefix}*')

        for pattern in patterns:
            async for key in redis.scan_iter(pattern):
                await redis.delete(key)
