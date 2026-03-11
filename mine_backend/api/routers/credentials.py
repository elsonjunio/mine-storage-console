from typing import List
from fastapi import APIRouter, Depends
from mine_backend.services.credential_service import CredentialService
from mine_backend.api.dependencies.authorization import require_role
from mine_backend.api.dependencies.cache import get_cache_manager
from mine_backend.core.cache import CacheManager
from mine_backend.api.schemas.response import StandardResponse
from mine_backend.api.utils.response import success_response
from mine_backend.api.schemas.credentials import (
    CredentialsResponse,
    CreatedCredentialsResponse,
    CreateCredentialRequest,
)

from mine_backend.config import get_admin, settings


router = APIRouter(prefix='/credentials', tags=['admin-credentials'])


def get_service():
    return CredentialService(get_admin())


@router.get(
    '',
    response_model=StandardResponse[List[CredentialsResponse]],
)
async def list_credentials(
    username: str,
    service: CredentialService = Depends(get_service),
    cache: CacheManager = Depends(get_cache_manager),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):
    credentials = await cache.get_or_set(
        f'credentials:{username}',
        service.list_credentials,
        username,
    )
    return success_response(credentials)


@router.post(
    '',
    response_model=StandardResponse[List[CreatedCredentialsResponse]],
)
async def create_credential(
    payload: CreateCredentialRequest,
    service: CredentialService = Depends(get_service),
    cache: CacheManager = Depends(get_cache_manager),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):
    credentials = service.create_credential(
        payload.username,
        payload.policy,
        payload.expiration,
    )
    await cache.invalidate(f'credentials:{payload.username}')
    return success_response(credentials)


@router.delete(
    '/{access_key}',
    response_model=StandardResponse[List[CredentialsResponse]],
)
async def delete_credential(
    access_key: str,
    service: CredentialService = Depends(get_service),
    cache: CacheManager = Depends(get_cache_manager),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):
    credentials = service.delete_credential(access_key)
    # username not available from access_key alone — bust all credential caches
    await cache.invalidate_prefix('credentials:')
    return success_response(credentials)
