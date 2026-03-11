from fastapi import APIRouter, Depends, File, UploadFile
from mine_backend.core.security import extract_sts_credentials
from mine_backend.config import get_s3_client
from mine_backend.services.object_service import ObjectService
from mine_backend.api.dependencies.auth import get_current_user
from mine_backend.api.dependencies.cache import get_cache_manager
from mine_backend.core.cache import CacheManager

from mine_backend.api.schemas.response import StandardResponse
from mine_backend.api.utils.response import success_response
from mine_backend.api.schemas.objects import (
    ListObjectsResponse,
    ObjectMessageReponse,
    GenerateUploadUrlResponse,
    GenerateDownloadUrlResponse,
    ListObjectVersionsResponse,
    DeleteObjectVersionResponse,
    RestoreObjectVersionResponse,
    ObjectMetadataResponse,
    UpdateObjectMetadataRequest,
    UpdateObjectMetadataResponse,
    UpdateObjectTagsResponse,
    ObjectTagsResponse,
    PresignedDownloadRequest,
    UpdateObjectTagsRequest,
)


router = APIRouter(prefix='/objects', tags=['objects'])


def get_sts(session: dict = Depends(get_current_user)):
    return extract_sts_credentials(session)


def get_object_service(sts=Depends(get_sts)):
    s3_client = get_s3_client(sts)
    return ObjectService(s3_client)


@router.get(
    '',
    response_model=StandardResponse[ListObjectsResponse],
)
async def list_objects(
    bucket: str,
    prefix: str | None = None,
    limit: int = 100,
    continuation_token: str | None = None,
    service: ObjectService = Depends(get_object_service),
    cache: CacheManager = Depends(get_cache_manager),
):
    cache_key = f'objects:{bucket}:{prefix or ""}:{limit}:{continuation_token or ""}'
    response = await cache.get_or_set(
        cache_key,
        service.list_objects,
        bucket,
        prefix,
        limit,
        continuation_token,
    )
    return success_response(response)


@router.delete(
    '',
    response_model=StandardResponse[ObjectMessageReponse],
)
async def delete_object(
    key: str,
    bucket: str,
    service: ObjectService = Depends(get_object_service),
    cache: CacheManager = Depends(get_cache_manager),
):
    response = service.delete_object(bucket, key)
    await cache.invalidate_prefix(f'objects:{bucket}:')
    return success_response(response)


# --------------------------------------------------------
# COPY OBJECT
# --------------------------------------------------------
@router.post(
    '/copy',
    response_model=StandardResponse[ObjectMessageReponse],
)
async def copy_object(
    source_bucket: str,
    source_key: str,
    dest_bucket: str,
    dest_key: str,
    service: ObjectService = Depends(get_object_service),
    cache: CacheManager = Depends(get_cache_manager),
):
    response = service.copy_object(source_bucket, source_key, dest_bucket, dest_key)
    await cache.invalidate_prefix(f'objects:{dest_bucket}:')
    return success_response(response)


@router.post(
    '/move',
    response_model=StandardResponse[ObjectMessageReponse],
)
async def move_object(
    source_bucket: str,
    source_key: str,
    dest_bucket: str,
    dest_key: str,
    service: ObjectService = Depends(get_object_service),
    cache: CacheManager = Depends(get_cache_manager),
):
    response = service.move_object(source_bucket, source_key, dest_bucket, dest_key)
    await cache.invalidate_prefix(f'objects:{source_bucket}:', f'objects:{dest_bucket}:')
    return success_response(response)


@router.post(
    '/upload',
    response_model=StandardResponse[ObjectMessageReponse],
)
async def upload_object(
    bucket: str,
    key: str,
    content_type: str | None = None,
    file: UploadFile = File(...),
    service: ObjectService = Depends(get_object_service),
    cache: CacheManager = Depends(get_cache_manager),
):
    data = await file.read()
    ct = content_type or file.content_type or 'application/octet-stream'
    response = await service.upload_object_proxy(bucket, key, data, ct)
    await cache.invalidate_prefix(f'objects:{bucket}:')
    return success_response(response)


@router.post(
    '/upload-url',
    response_model=StandardResponse[GenerateUploadUrlResponse],
)
def generate_upload_url(
    bucket: str,
    key: str,
    content_type: str | None = None,
    expires_in: int = 3600,
    service: ObjectService = Depends(get_object_service),
):
    response = service.generate_upload_url(
        bucket,
        key,
        expires_in,
        content_type,
    )
    return success_response(response)


@router.post(
    '/presigned-download',
    response_model=StandardResponse[GenerateDownloadUrlResponse],
)
def generate_presigned_download(
    payload: PresignedDownloadRequest,
    service: ObjectService = Depends(get_object_service),
):
    disposition = None

    if payload.download_as:
        disposition = f'attachment; filename="{payload.download_as}"'

    response = service.generate_download_url(
        bucket=payload.bucket,
        key=payload.key,
        expires_in=payload.expires_in,
        response_content_type=payload.content_type,
        response_content_disposition=disposition,
    )
    return success_response(response)


@router.get(
    '/versions',
    response_model=StandardResponse[ListObjectVersionsResponse],
)
async def list_versions(
    bucket: str,
    key: str,
    service: ObjectService = Depends(get_object_service),
    cache: CacheManager = Depends(get_cache_manager),
):
    response = await cache.get_or_set(
        f'objects:{bucket}:{key}:versions',
        service.list_object_versions,
        bucket,
        key,
    )
    return success_response(response)


@router.delete(
    '/version',
    response_model=StandardResponse[DeleteObjectVersionResponse],
)
async def delete_version(
    bucket: str,
    key: str,
    version_id: str,
    service: ObjectService = Depends(get_object_service),
    cache: CacheManager = Depends(get_cache_manager),
):
    response = service.delete_object_version(bucket, key, version_id)
    await cache.invalidate(f'objects:{bucket}:{key}:versions')
    await cache.invalidate_prefix(f'objects:{bucket}:')
    return success_response(response)


@router.post(
    '/restore-version',
    response_model=StandardResponse[RestoreObjectVersionResponse],
)
async def restore_version(
    bucket: str,
    key: str,
    version_id: str,
    service: ObjectService = Depends(get_object_service),
    cache: CacheManager = Depends(get_cache_manager),
):
    response = service.restore_object_version(bucket, key, version_id)
    await cache.invalidate(f'objects:{bucket}:{key}:versions')
    await cache.invalidate_prefix(f'objects:{bucket}:')
    return success_response(response)


@router.get(
    '/metadata',
    response_model=StandardResponse[ObjectMetadataResponse],
)
async def get_object_metadata(
    bucket: str,
    key: str,
    service: ObjectService = Depends(get_object_service),
    cache: CacheManager = Depends(get_cache_manager),
):
    response = await cache.get_or_set(
        f'objects:{bucket}:{key}:metadata',
        service.get_object_metadata,
        bucket,
        key,
    )
    return success_response(response)


@router.put(
    '/metadata',
    response_model=StandardResponse[UpdateObjectMetadataResponse],
)
async def update_object_metadata(
    payload: UpdateObjectMetadataRequest,
    service: ObjectService = Depends(get_object_service),
    cache: CacheManager = Depends(get_cache_manager),
):
    response = service.update_object_metadata(payload.bucket, payload.key, payload.metadata)
    await cache.invalidate(f'objects:{payload.bucket}:{payload.key}:metadata')
    return success_response(response)


@router.get(
    '/tags',
    response_model=StandardResponse[ObjectTagsResponse],
)
async def get_object_tags(
    bucket: str,
    key: str,
    service: ObjectService = Depends(get_object_service),
    cache: CacheManager = Depends(get_cache_manager),
):
    response = await cache.get_or_set(
        f'objects:{bucket}:{key}:tags',
        service.get_object_tags,
        bucket,
        key,
    )
    return success_response(response)


@router.put(
    '/tags',
    response_model=StandardResponse[UpdateObjectTagsResponse],
)
async def update_object_tags(
    payload: UpdateObjectTagsRequest,
    service: ObjectService = Depends(get_object_service),
    cache: CacheManager = Depends(get_cache_manager),
):
    response = service.update_object_tags(payload.bucket, payload.key, payload.tags)
    await cache.invalidate(f'objects:{payload.bucket}:{payload.key}:tags')
    return success_response(response)
