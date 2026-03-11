from fastapi import Depends

from mine_backend.api.dependencies.auth import get_current_user
from mine_backend.api.dependencies.authorization import is_admin
from mine_backend.core.cache import CacheManager


def get_cache_manager(
    session: dict = Depends(get_current_user),
) -> CacheManager:
    user_id: str = session.get('sub', 'anonymous')
    admin: bool = is_admin(session)
    return CacheManager(user_id=user_id, is_admin=admin)
