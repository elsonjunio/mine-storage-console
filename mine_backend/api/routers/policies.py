from fastapi import APIRouter, Depends
from mine_backend.services.policy_service import PolicyService
from mine_backend.api.dependencies.authorization import require_role
from mine_backend.api.dependencies.cache import get_cache_manager
from mine_backend.core.cache import CacheManager
from mine_backend.api.utils.response import success_response
from mine_backend.api.schemas.response import StandardResponse
from mine_backend.api.schemas.policies import (
    PolicyResponse,
    PolicyGroupsResponse,
    PolicyAttachedResponse,
    PolicyDetachedResponse,
    CreatePolicyRequest,
    AttachPolicyRequest,
)
from typing import List
from mine_backend.config import get_admin, settings

router = APIRouter(prefix='/policies', tags=['admin-policies'])


def get_service():
    return PolicyService(get_admin())


@router.get(
    '',
    response_model=StandardResponse[List[PolicyResponse]],
)
async def list_policies(
    service: PolicyService = Depends(get_service),
    cache: CacheManager = Depends(get_cache_manager),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):
    policies = await cache.get_or_set('policies:list', service.list_policies)
    return success_response(policies)


@router.get(
    '/{name}/groups',
    response_model=StandardResponse[List[PolicyGroupsResponse]],
)
async def get_policy_groups(
    name: str,
    service: PolicyService = Depends(get_service),
    cache: CacheManager = Depends(get_cache_manager),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):
    groups = await cache.get_or_set(
        f'policies:{name}:groups',
        service.get_groups_by_policy,
        name,
    )
    return success_response([PolicyGroupsResponse(policy=name, groups=groups or [])])


@router.get(
    '/{name}',
    response_model=StandardResponse[List[PolicyResponse]],
)
async def get_policy(
    name: str,
    service: PolicyService = Depends(get_service),
    cache: CacheManager = Depends(get_cache_manager),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):
    policy = await cache.get_or_set(f'policies:{name}', service.get_policy, name)
    return success_response(policy)


@router.post(
    '',
    response_model=StandardResponse[List[PolicyResponse]],
)
async def create_policy(
    payload: CreatePolicyRequest,
    service: PolicyService = Depends(get_service),
    cache: CacheManager = Depends(get_cache_manager),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):
    policy = service.create_policy(payload.name, payload.document)
    await cache.invalidate('policies:list')
    return success_response(policy)


@router.delete(
    '/{name}',
    response_model=StandardResponse[List[PolicyResponse]],
)
async def delete_policy(
    name: str,
    service: PolicyService = Depends(get_service),
    cache: CacheManager = Depends(get_cache_manager),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):
    policy = service.delete_policy(name)
    await cache.invalidate('policies:list', f'policies:{name}')
    return success_response(policy)


@router.post(
    '/attach',
    response_model=StandardResponse[List[PolicyAttachedResponse]],
)
async def attach_policy(
    payload: AttachPolicyRequest,
    service: PolicyService = Depends(get_service),
    cache: CacheManager = Depends(get_cache_manager),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):
    attached_policy = service.attach_policy(payload.policy, payload.username)
    await cache.invalidate(f'policies:{payload.policy}:groups', 'users:list')
    return success_response(attached_policy)


@router.post(
    '/detach',
    response_model=StandardResponse[List[PolicyDetachedResponse]],
)
async def detach_policy(
    payload: AttachPolicyRequest,
    service: PolicyService = Depends(get_service),
    cache: CacheManager = Depends(get_cache_manager),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):
    attached_policy = service.detach_policy(payload.policy, payload.username)
    await cache.invalidate(f'policies:{payload.policy}:groups', 'users:list')
    return success_response(attached_policy)
