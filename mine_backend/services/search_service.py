import asyncio
import json
import uuid
from typing import AsyncGenerator

from mine_spec.ports.admin import UserAdminPort
from mine_spec.ports.object_storage import ObjectStoragePort

from mine_backend.core.redis import redis
from mine_backend.exceptions.application import ServiceUnavailableError

SEARCH_TTL = 300  # 5 minutes
OBJECTS_LIMIT_PER_BUCKET = 200


class SearchService:
    def __init__(
        self,
        s3_client: ObjectStoragePort,
        storage_admin: UserAdminPort,
        is_admin: bool,
    ):
        self.s3 = s3_client
        self.storage_admin = storage_admin
        self.is_admin = is_admin

    def _require_redis(self) -> None:
        if redis is None:
            raise ServiceUnavailableError(
                'Search requires Redis to be configured'
            )

    async def create_session(self, query: str) -> str:
        self._require_redis()

        search_id = str(uuid.uuid4())
        session = {
            'query': query,
            'status': 'pending',
            'cancelled': False,
        }
        await redis.setex(  # type: ignore[union-attr]
            f'search:{search_id}',
            SEARCH_TTL,
            json.dumps(session),
        )
        return search_id

    async def cancel_session(self, search_id: str) -> None:
        self._require_redis()

        key = f'search:{search_id}'
        raw = await redis.get(key)  # type: ignore[union-attr]
        if not raw:
            return

        session = json.loads(raw)
        session['cancelled'] = True
        await redis.setex(key, SEARCH_TTL, json.dumps(session))  # type: ignore[union-attr]

    async def _is_cancelled(self, search_id: str) -> bool:
        if redis is None:
            return False

        raw = await redis.get(f'search:{search_id}')
        if not raw:
            return True  # expired session → treat as cancelled

        session = json.loads(raw)
        return bool(session.get('cancelled', False))

    def _sse_event(self, event: str, data: dict) -> str:
        return f'event: {event}\ndata: {json.dumps(data)}\n\n'

    async def stream_results(
        self, search_id: str
    ) -> AsyncGenerator[str, None]:
        self._require_redis()

        raw = await redis.get(f'search:{search_id}')  # type: ignore[union-attr]
        if not raw:
            return

        session = json.loads(raw)
        query = session['query'].lower()

        # ── Buckets ────────────────────────────────────────────────────────
        try:
            buckets = await asyncio.to_thread(self.s3.list_buckets)
            for bucket in buckets:
                if await self._is_cancelled(search_id):
                    return
                if query in bucket.name.lower():
                    yield self._sse_event(
                        'result', {'type': 'bucket', 'name': bucket.name}
                    )
        except Exception:
            pass

        # ── Objects ────────────────────────────────────────────────────────
        try:
            buckets = await asyncio.to_thread(self.s3.list_buckets)
            for bucket in buckets:
                if await self._is_cancelled(search_id):
                    return
                try:
                    result = await asyncio.to_thread(
                        self.s3.list_objects,
                        bucket=bucket.name,
                        prefix=None,
                        limit=OBJECTS_LIMIT_PER_BUCKET,
                        continuation_token=None,
                    )
                    objects = getattr(result, 'objects', []) or []
                    for obj in objects:
                        if await self._is_cancelled(search_id):
                            return
                        key = getattr(obj, 'key', '') or ''
                        if query in key.lower():
                            yield self._sse_event(
                                'result',
                                {
                                    'type': 'object',
                                    'bucket': bucket.name,
                                    'key': key,
                                },
                            )
                except Exception:
                    pass
        except Exception:
            pass

        # ── Admin-only resources ───────────────────────────────────────────
        if self.is_admin and self.storage_admin:

            # Users
            try:
                users = await asyncio.to_thread(
                    self.storage_admin.list_users
                )
                for user in users:
                    if await self._is_cancelled(search_id):
                        return
                    name = getattr(user, 'access_key', '') or str(user)
                    if query in name.lower():
                        yield self._sse_event(
                            'result', {'type': 'user', 'name': name}
                        )
            except Exception:
                pass

            # Groups
            try:
                groups = await asyncio.to_thread(
                    self.storage_admin.list_groups
                )
                for group in groups:
                    if await self._is_cancelled(search_id):
                        return
                    name = getattr(group, 'name', '') or str(group)
                    if query in name.lower():
                        yield self._sse_event(
                            'result', {'type': 'group', 'name': name}
                        )
            except Exception:
                pass

            # Policies
            try:
                policies = await asyncio.to_thread(
                    self.storage_admin.list_policies
                )
                for policy in policies:
                    if await self._is_cancelled(search_id):
                        return
                    name = getattr(policy, 'name', '') or str(policy)
                    if query in name.lower():
                        yield self._sse_event(
                            'result', {'type': 'policy', 'name': name}
                        )
            except Exception:
                pass

        yield 'event: complete\ndata: {}\n\n'
