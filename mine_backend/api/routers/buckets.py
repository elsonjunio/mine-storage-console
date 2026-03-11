from fastapi import APIRouter, Depends
from mine_backend.core.security import extract_sts_credentials
from mine_backend.config import get_s3_client
from mine_backend.services.bucket_service import BucketService
from mine_backend.api.dependencies.authorization import require_role
from mine_backend.api.dependencies.auth import get_current_user
from mine_backend.api.dependencies.cache import get_cache_manager
from mine_backend.core.cache import CacheManager

from mine_backend.api.schemas.response import StandardResponse
from mine_backend.api.utils.response import success_response
from mine_backend.api.schemas.buckets import (
    BucketPolicyResponse,
    BucketQuotaGetResponse,
    BucketResponse,
    BucketStatusResponse,
    BucketUsageResponse,
    BucketVersionResponse,
    UpdateBucketPolicyRequest,
    UpdateBucketLifecycleRequest,
    LifecycleValidationResponse,
)
from typing import List

from mine_backend.config import get_admin, settings


router = APIRouter(prefix='/buckets', tags=['buckets'])


def get_sts(session: dict = Depends(get_current_user)):
    return extract_sts_credentials(session)


def get_bucket_service(sts=Depends(get_sts)):
    s3_client = get_s3_client(sts)
    storage_admin = get_admin()
    return BucketService(s3_client, storage_admin)


@router.get(
    '',
    response_model=StandardResponse[List[BucketResponse]],
)
async def list_buckets(
    service: BucketService = Depends(get_bucket_service),
    cache: CacheManager = Depends(get_cache_manager),
):
    bucket_list = await cache.get_or_set('buckets:list', service.list_buckets)
    return success_response(bucket_list)


@router.post(
    '',
    response_model=StandardResponse[BucketStatusResponse],
)
async def create_bucket(
    name: str,
    service: BucketService = Depends(get_bucket_service),
    cache: CacheManager = Depends(get_cache_manager),
):
    bucket = service.create_bucket(name)
    await cache.invalidate('buckets:list')
    return success_response(bucket)


@router.delete(
    '/{name}',
    response_model=StandardResponse[BucketStatusResponse],
)
async def delete_bucket(
    name: str,
    service: BucketService = Depends(get_bucket_service),
    cache: CacheManager = Depends(get_cache_manager),
):
    bucket = service.delete_bucket(name)
    await cache.invalidate('buckets:list')
    await cache.invalidate_prefix(f'buckets:{name}:')
    return success_response(bucket)


@router.get(
    '/{name}/versioning',
    response_model=StandardResponse[BucketVersionResponse],
)
async def get_versioning(
    name: str,
    service: BucketService = Depends(get_bucket_service),
    cache: CacheManager = Depends(get_cache_manager),
):
    version = await cache.get_or_set(f'buckets:{name}:versioning', service.get_versioning, name)
    return success_response(version)


@router.put(
    '/{name}/versioning',
    response_model=StandardResponse[BucketVersionResponse],
)
async def set_versioning(
    name: str,
    enabled: bool,
    service: BucketService = Depends(get_bucket_service),
    cache: CacheManager = Depends(get_cache_manager),
):
    version = service.set_versioning(name, enabled)
    await cache.invalidate(f'buckets:{name}:versioning')
    return success_response(version)


@router.put(
    '/{name}/quota',
    response_model=StandardResponse[List[BucketQuotaGetResponse]],
)
async def set_quota(
    name: str,
    quota_bytes: int,
    service: BucketService = Depends(get_bucket_service),
    cache: CacheManager = Depends(get_cache_manager),
):
    quota = service.set_quota(name, quota_bytes)
    await cache.invalidate(f'buckets:{name}:quota', 'quotas:overview')
    return success_response(quota)


@router.get(
    '/{name}/quota',
    response_model=StandardResponse[List[BucketQuotaGetResponse]],
)
async def get_quota(
    name: str,
    service: BucketService = Depends(get_bucket_service),
    cache: CacheManager = Depends(get_cache_manager),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):
    quota = await cache.get_or_set(f'buckets:{name}:quota', service.get_quota, name)
    return success_response(quota)


@router.get(
    '/{name}/usage',
    response_model=StandardResponse[BucketUsageResponse],
)
async def get_usage(
    name: str,
    service: BucketService = Depends(get_bucket_service),
    cache: CacheManager = Depends(get_cache_manager),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):
    usage = await cache.get_or_set(f'buckets:{name}:usage', service.get_usage, name)
    return success_response(usage)


@router.post(
    '/{name}/policy/validate',
    response_model=StandardResponse[LifecycleValidationResponse],
)
def validate_policy(
    name: str,
    payload: UpdateBucketPolicyRequest,
    service: BucketService = Depends(get_bucket_service),
):
    result = service.validate_policy(payload.policy)
    return success_response(result)


@router.get(
    '/{name}/policy',
    response_model=StandardResponse[BucketPolicyResponse],
)
async def get_bucket_policy(
    name: str,
    service: BucketService = Depends(get_bucket_service),
    cache: CacheManager = Depends(get_cache_manager),
):
    policy = await cache.get_or_set(f'buckets:{name}:policy', service.get_bucket_policy, name)
    return success_response(policy)


@router.put(
    '/{name}/policy',
    response_model=StandardResponse[BucketStatusResponse],
)
async def put_bucket_policy(
    name: str,
    payload: UpdateBucketPolicyRequest,
    service: BucketService = Depends(get_bucket_service),
    cache: CacheManager = Depends(get_cache_manager),
):
    policy = service.put_bucket_policy(name, payload.policy)
    await cache.invalidate(f'buckets:{name}:policy')
    return success_response(policy)


@router.delete(
    '/{name}/policy',
    response_model=StandardResponse[BucketStatusResponse],
)
async def delete_bucket_policy(
    name: str,
    service: BucketService = Depends(get_bucket_service),
    cache: CacheManager = Depends(get_cache_manager),
):
    policy = service.delete_bucket_policy(name)
    await cache.invalidate(f'buckets:{name}:policy')
    return success_response(policy)


@router.get(
    '/{name}/lifecycle',
    response_model=StandardResponse[dict],
)
async def get_bucket_lifecycle(
    name: str,
    service: BucketService = Depends(get_bucket_service),
    cache: CacheManager = Depends(get_cache_manager),
):
    lifecycle = await cache.get_or_set(f'buckets:{name}:lifecycle', service.get_bucket_lifecycle, name)
    return success_response(lifecycle)


@router.post(
    '/{name}/lifecycle/validate',
    response_model=StandardResponse[LifecycleValidationResponse],
)
def validate_lifecycle(
    name: str,
    payload: UpdateBucketLifecycleRequest,
    service: BucketService = Depends(get_bucket_service),
):
    result = service.validate_lifecycle(payload.lifecycle)
    return success_response(result)


@router.put(
    '/{name}/lifecycle',
    response_model=StandardResponse[BucketStatusResponse],
)
async def put_bucket_lifecycle(
    name: str,
    payload: UpdateBucketLifecycleRequest,
    service: BucketService = Depends(get_bucket_service),
    cache: CacheManager = Depends(get_cache_manager),
):
    lifecycle = service.put_bucket_lifecycle(name, payload.lifecycle)
    await cache.invalidate(f'buckets:{name}:lifecycle')
    return success_response(lifecycle)


@router.delete(
    '/{name}/lifecycle',
    response_model=StandardResponse[BucketStatusResponse],
)
async def delete_bucket_lifecycle(
    name: str,
    service: BucketService = Depends(get_bucket_service),
    cache: CacheManager = Depends(get_cache_manager),
):
    lifecycle = service.delete_bucket_lifecycle(name)
    await cache.invalidate(f'buckets:{name}:lifecycle')
    return success_response(lifecycle)


@router.get(
    '/{name}/events',
    response_model=StandardResponse[dict],
)
async def get_bucket_events(
    name: str,
    service: BucketService = Depends(get_bucket_service),
    cache: CacheManager = Depends(get_cache_manager),
):
    events = await cache.get_or_set(f'buckets:{name}:events', service.get_bucket_events, name)
    return success_response(events)


@router.put(
    '/{name}/events',
    response_model=StandardResponse[dict],
)
async def put_bucket_events(
    name: str,
    payload: dict,
    service: BucketService = Depends(get_bucket_service),
    cache: CacheManager = Depends(get_cache_manager),
):
    events = service.put_bucket_events(name, payload)
    await cache.invalidate(f'buckets:{name}:events')
    return success_response(events)


@router.delete(
    '/{name}/events',
    response_model=StandardResponse[dict],
)
async def delete_bucket_events(
    name: str,
    service: BucketService = Depends(get_bucket_service),
    cache: CacheManager = Depends(get_cache_manager),
):
    events = service.delete_bucket_events(name)
    await cache.invalidate(f'buckets:{name}:events')
    return success_response(events)
