from typing import List
from mine_backend.services.admin_notification_service import (
    AdminNotificationService,
)
from fastapi import APIRouter, Depends
from mine_backend.api.dependencies.authorization import require_role
from mine_backend.api.dependencies.cache import get_cache_manager
from mine_backend.core.cache import CacheManager

from mine_backend.api.schemas.response import StandardResponse
from mine_backend.api.utils.response import success_response
from mine_backend.api.schemas.admin_notifications import (
    NotificationConfigResponse,
    CreateWebhookRequest,
)

from mine_backend.config import get_admin, settings


router = APIRouter(prefix='/admin/notifications', tags=['admin-notifications'])


@router.post(
    '/{type}',
    response_model=StandardResponse[List[dict]],
)
async def create_webhook(
    type: str,
    payload: CreateWebhookRequest,
    cache: CacheManager = Depends(get_cache_manager),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):
    service = AdminNotificationService(get_admin())
    response = service.create_target(type, payload.identifier, payload.config)
    await cache.invalidate(f'notifications:{type}')
    return success_response(response)


@router.delete('/{type}/{identifier}')
async def delete_webhook(
    type: str,
    identifier: str,
    cache: CacheManager = Depends(get_cache_manager),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):
    service = AdminNotificationService(get_admin())
    response = service.delete_target(type, identifier)
    await cache.invalidate(f'notifications:{type}')
    return success_response(response)


@router.get(
    '/{type}',
    response_model=StandardResponse[List[NotificationConfigResponse]],
)
async def list_webhooks(
    type: str,
    cache: CacheManager = Depends(get_cache_manager),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):
    service = AdminNotificationService(get_admin())
    response = await cache.get_or_set(
        f'notifications:{type}',
        service.list_targets,
        type,
    )
    return success_response(response)
