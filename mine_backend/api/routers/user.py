from fastapi import APIRouter, Depends
from mine_backend.api.utils.response import success_response
from mine_backend.services.user_service import UserService

from mine_backend.api.dependencies.authorization import require_role
from mine_backend.api.dependencies.cache import get_cache_manager
from mine_backend.core.cache import CacheManager

from mine_backend.api.schemas.response import StandardResponse
from mine_backend.api.schemas.user import (
    UserResponse,
    CreateUserRequest,
)
from typing import List
from mine_backend.config import get_admin, settings


router = APIRouter(prefix='/users', tags=['admin-users'])


def get_service():
    return UserService(get_admin())


@router.get(
    '',
    response_model=StandardResponse[List[UserResponse]],
)
async def list_users(
    service: UserService = Depends(get_service),
    cache: CacheManager = Depends(get_cache_manager),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):
    users = await cache.get_or_set('users:list', service.list_users)
    return success_response(users)


@router.get(
    '/{username}',
    response_model=StandardResponse[List[UserResponse]],
)
async def get_user(
    username: str,
    service: UserService = Depends(get_service),
    cache: CacheManager = Depends(get_cache_manager),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):
    user_data = await cache.get_or_set(f'users:{username}', service.get_user, username)
    return success_response(user_data)


@router.post('', response_model=StandardResponse[List[UserResponse]])
async def create_user(
    payload: CreateUserRequest,
    service: UserService = Depends(get_service),
    cache: CacheManager = Depends(get_cache_manager),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):
    user_data = service.create_user(payload.username, payload.password)
    await cache.invalidate('users:list')
    return success_response(user_data)


@router.delete(
    '/{username}',
    response_model=StandardResponse[List[UserResponse]],
)
async def delete_user(
    username: str,
    service: UserService = Depends(get_service),
    cache: CacheManager = Depends(get_cache_manager),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):
    deleted_user_data = service.delete_user(username)
    await cache.invalidate('users:list', f'users:{username}')
    return success_response(deleted_user_data)


@router.post(
    '/{username}/enable',
    response_model=StandardResponse[List[UserResponse]],
)
async def enable_user(
    username: str,
    service: UserService = Depends(get_service),
    cache: CacheManager = Depends(get_cache_manager),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):
    result = service.enable_user(username)
    await cache.invalidate('users:list', f'users:{username}')
    return success_response(result)


@router.post(
    '/{username}/disable',
    response_model=StandardResponse[List[UserResponse]],
)
async def disable_user(
    username: str,
    service: UserService = Depends(get_service),
    cache: CacheManager = Depends(get_cache_manager),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):
    result = service.disable_user(username)
    await cache.invalidate('users:list', f'users:{username}')
    return success_response(result)
