from fastapi import APIRouter, Depends
from typing import List
from mine_backend.services.group_service import GroupService
from mine_backend.api.dependencies.authorization import require_role
from mine_backend.api.dependencies.cache import get_cache_manager
from mine_backend.core.cache import CacheManager

from mine_backend.api.schemas.response import StandardResponse
from mine_backend.api.schemas.group import (
    GroupResponse,
    GroupListResponse,
    GroupPolicyReponse,
    GroupPolicyMappReponse,
    CreateGroupRequest,
    GroupUsersRequest,
    DeleteGroupUsersRequest,
    GroupPolicyRequest,
    GroupPolicyDeatached,
    GroupPolicyAttached,

)
from mine_backend.api.utils.response import success_response

from mine_backend.config import get_admin, settings


router = APIRouter(prefix='/groups', tags=['admin-groups'])


def get_service():
    return GroupService(get_admin())


@router.get(
    '',
    response_model=StandardResponse[List[GroupListResponse]],
)
async def list_groups(
    service: GroupService = Depends(get_service),
    cache: CacheManager = Depends(get_cache_manager),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):
    group_list = await cache.get_or_set('groups:list', service.list_groups)
    return success_response(group_list)


@router.get(
    '/{name}',
    response_model=StandardResponse[List[GroupResponse]],
)
async def get_group(
    name: str,
    service: GroupService = Depends(get_service),
    cache: CacheManager = Depends(get_cache_manager),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):
    group = await cache.get_or_set(f'groups:{name}', service.get_group, name)
    return success_response(group)


@router.post(
    '',
    response_model=StandardResponse[List[GroupResponse]],
)
async def create_group(
    payload: CreateGroupRequest,
    service: GroupService = Depends(get_service),
    cache: CacheManager = Depends(get_cache_manager),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):
    group = service.create_group(payload.name, payload.users)
    await cache.invalidate('groups:list')
    return success_response(group)


@router.delete(
    '/{name}',
    response_model=StandardResponse[List[GroupResponse]],
)
async def delete_group(
    name: str,
    service: GroupService = Depends(get_service),
    cache: CacheManager = Depends(get_cache_manager),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):
    group = service.delete_group(name)
    await cache.invalidate('groups:list', f'groups:{name}')
    return success_response(group)


@router.post(
    '/users',
    response_model=StandardResponse[List[GroupResponse]],
)
async def add_users(
    payload: GroupUsersRequest,
    service: GroupService = Depends(get_service),
    cache: CacheManager = Depends(get_cache_manager),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):
    group = service.add_users(payload.name, payload.users)
    await cache.invalidate('groups:list', f'groups:{payload.name}')
    return success_response(group)


@router.delete(
    '/{name}/users',
    response_model=StandardResponse[List[GroupResponse]],
)
async def remove_users(
    name: str,
    payload: DeleteGroupUsersRequest,
    service: GroupService = Depends(get_service),
    cache: CacheManager = Depends(get_cache_manager),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):
    group = service.remove_users(name, payload.users)
    await cache.invalidate('groups:list', f'groups:{name}')
    return success_response(group)


@router.post(
    '/enable/{name}',
    response_model=StandardResponse[List[GroupResponse]],
)
async def enable_group(
    name: str,
    service: GroupService = Depends(get_service),
    cache: CacheManager = Depends(get_cache_manager),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):
    group = service.enable_group(name)
    await cache.invalidate('groups:list', f'groups:{name}')
    return success_response(group)


@router.post(
    '/disable/{name}',
    response_model=StandardResponse[List[GroupResponse]],
)
async def disable_group(
    name: str,
    service: GroupService = Depends(get_service),
    cache: CacheManager = Depends(get_cache_manager),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):
    group = service.disable_group(name)
    await cache.invalidate('groups:list', f'groups:{name}')
    return success_response(group)


@router.post(
    '/attach-policy',
    response_model=StandardResponse[List[GroupPolicyAttached]],
)
async def attach_policy(
    payload: GroupPolicyRequest,
    service: GroupService = Depends(get_service),
    cache: CacheManager = Depends(get_cache_manager),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):
    group_policy = service.attach_policy(payload.group, payload.policy)
    await cache.invalidate(f'groups:{payload.group}:policies')
    return success_response(group_policy)


@router.post(
    '/detach-policy',
    response_model=StandardResponse[List[GroupPolicyDeatached]],
)
async def detach_policy(
    payload: GroupPolicyRequest,
    service: GroupService = Depends(get_service),
    cache: CacheManager = Depends(get_cache_manager),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):
    group_policy = service.detach_policy(payload.group, payload.policy)
    await cache.invalidate(f'groups:{payload.group}:policies')
    return success_response(group_policy)


@router.get(
    '/{name}/policies',
    response_model=StandardResponse[List[GroupPolicyMappReponse]],
)
async def policies(
    name: str,
    service: GroupService = Depends(get_service),
    cache: CacheManager = Depends(get_cache_manager),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):
    group_policy = await cache.get_or_set(
        f'groups:{name}:policies',
        service.get_attach_policy,
        name,
    )
    return success_response(group_policy)
