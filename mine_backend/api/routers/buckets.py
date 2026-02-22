from fastapi import APIRouter, Depends
from mine_backend.core.security import extract_sts_credentials
from mine_backend.config import get_s3_client
from mine_backend.services.bucket_service import BucketService
from mine_backend.api.dependencies.authorization import require_role
from mine_backend.api.dependencies.auth import get_current_user

from mine_backend.api.schemas.response import StandardResponse
from mine_backend.api.utils.response import success_response
from mine_backend.api.schemas.buckets import (
    BucketPolicyResponse,
    BucketQuotaGetResponse,
    BucketResponse,
    BucketStatusResponse,
    BucketUsageResponse,
    BucketVersionResponse,
    BucketQuotaResponse,
    UpdateBucketPolicyRequest,
    UpdateBucketLifecycleRequest,
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
def list_buckets(service: BucketService = Depends(get_bucket_service)):
    bucket_list = service.list_buckets()
    return success_response(bucket_list)


@router.post(
    '',
    response_model=StandardResponse[BucketStatusResponse],
)
def create_bucket(
    name: str, service: BucketService = Depends(get_bucket_service)
):
    bucket = service.create_bucket(name)
    return success_response(bucket)


@router.delete(
    '/{name}',
    response_model=StandardResponse[BucketStatusResponse],
)
def delete_bucket(
    name: str, service: BucketService = Depends(get_bucket_service)
):
    bucket = service.delete_bucket(name)
    return success_response(bucket)


@router.put(
    '/{name}/versioning',
    response_model=StandardResponse[BucketVersionResponse],
)
def set_versioning(
    name: str,
    enabled: bool,
    service: BucketService = Depends(get_bucket_service),
):
    version = service.set_versioning(name, enabled)
    return success_response(version)


@router.put(
    '/{name}/quota',
    response_model=StandardResponse[List[BucketQuotaGetResponse]],
)
def set_quota(
    name: str,
    quota_bytes: int,
    service: BucketService = Depends(get_bucket_service),
):
    quota = service.set_quota(name, quota_bytes)
    return success_response(quota)


@router.get(
    '/{name}/quota',
    response_model=StandardResponse[List[BucketQuotaGetResponse]],
)
def get_quota(
    name: str,
    service: BucketService = Depends(get_bucket_service),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):
    quota = service.get_quota(name)
    return success_response(quota)


@router.get(
    '/{name}/usage',
    response_model=StandardResponse[BucketUsageResponse],
)
def get_usage(
    name: str,
    service: BucketService = Depends(get_bucket_service),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):
    usage = service.get_usage(name)
    return success_response(usage)


@router.get(
    '/{name}/policy',
    response_model=StandardResponse[BucketPolicyResponse],
)
def get_bucket_policy(
    name: str,
    service: BucketService = Depends(get_bucket_service),
):
    policy = service.get_bucket_policy(name)
    return success_response(policy)


@router.put(
    '/{name}/policy',
    response_model=StandardResponse[BucketStatusResponse],
)
def put_bucket_policy(
    name: str,
    payload: UpdateBucketPolicyRequest,
    service: BucketService = Depends(get_bucket_service),
):
    policy = service.put_bucket_policy(name, payload.policy)
    return success_response(policy)


@router.delete(
    '/{name}/policy',
    response_model=StandardResponse[BucketStatusResponse],
)
def delete_bucket_policy(
    name: str, service: BucketService = Depends(get_bucket_service)
):
    policy = service.delete_bucket_policy(name)
    return success_response(policy)


@router.get(
    '/{name}/lifecycle',
    response_model=StandardResponse[dict],
)
def get_bucket_lifecycle(
    name: str,
    service: BucketService = Depends(get_bucket_service),
):
    lifecycle = service.get_bucket_lifecycle(name)
    return success_response(lifecycle)


@router.put(
    '/{name}/lifecycle',
    response_model=StandardResponse[BucketStatusResponse],
)
def put_bucket_lifecycle(
    name: str,
    payload: UpdateBucketLifecycleRequest,
    service: BucketService = Depends(get_bucket_service),
):
    lifecycle = service.put_bucket_lifecycle(name, payload.lifecycle)
    return success_response(lifecycle)


@router.delete(
    '/{name}/lifecycle',
    response_model=StandardResponse[BucketStatusResponse],
)
def delete_bucket_lifecycle(
    name: str, service: BucketService = Depends(get_bucket_service)
):
    lifecycle = service.delete_bucket_lifecycle(name)
    return success_response(lifecycle)


@router.get(
    '/{name}/events',
    response_model=StandardResponse[dict],
)
def get_bucket_events(
    name: str,
    service: BucketService = Depends(get_bucket_service),
):
    events = service.get_bucket_events(name)
    return success_response(events)


@router.put(
    '/{name}/events',
    response_model=StandardResponse[dict],
)
def put_bucket_events(
    name: str,
    payload: dict,
    service: BucketService = Depends(get_bucket_service),
):
    events = service.put_bucket_events(name, payload)
    return success_response(events)


@router.delete(
    '/{name}/events',
    response_model=StandardResponse[dict],
)
def delete_bucket_events(
    name: str,
    service: BucketService = Depends(get_bucket_service),
):
    events = service.delete_bucket_events(name)
    return success_response(events)
