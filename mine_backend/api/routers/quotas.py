from fastapi import APIRouter, Depends
from typing import List

from mine_backend.services.bucket_service import BucketService
from mine_backend.api.dependencies.authorization import require_role
from mine_backend.api.dependencies.auth import get_current_user
from mine_backend.core.security import extract_sts_credentials
from mine_backend.api.utils.response import success_response
from mine_backend.api.schemas.response import StandardResponse
from mine_backend.api.schemas.quotas import (
    QuotaBucketRow,
    GlobalQuotaRequest,
    GlobalQuotaResponse,
)
from mine_backend.config import get_admin, get_s3_client, settings


router = APIRouter(prefix='/quotas', tags=['quotas'])


def get_sts(session: dict = Depends(get_current_user)):
    return extract_sts_credentials(session)


def get_service(sts=Depends(get_sts)):
    return BucketService(get_s3_client(sts), get_admin())


@router.get(
    '',
    response_model=StandardResponse[List[QuotaBucketRow]],
)
def get_quotas_overview(
    service: BucketService = Depends(get_service),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):
    data = service.get_quotas_overview()
    return success_response(data)


@router.put(
    '/global',
    response_model=StandardResponse[GlobalQuotaResponse],
)
def set_global_quota(
    payload: GlobalQuotaRequest,
    service: BucketService = Depends(get_service),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):
    result = service.set_global_quota(payload.quota_bytes)
    return success_response(result)


@router.delete(
    '/{name}',
    response_model=StandardResponse[dict],
)
def remove_bucket_quota(
    name: str,
    service: BucketService = Depends(get_service),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):
    result = service.remove_quota(name)
    return success_response(result)
