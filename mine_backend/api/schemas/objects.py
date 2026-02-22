from datetime import datetime
from typing import List, Optional, Dict
from pydantic import BaseModel, Field


class ObjectItemResponse(BaseModel):
    key: str
    size: int
    last_modified: datetime
    etag: str
    storage_class: Optional[str] = None


class ListObjectsResponse(BaseModel):
    bucket: str
    prefix: Optional[str] = None
    count: int
    objects: List[ObjectItemResponse]
    is_truncated: bool
    next_continuation_token: Optional[str] = None


class ObjectMessageReponse(BaseModel):
    message: str


class GenerateUploadUrlResponse(BaseModel):
    bucket: str
    key: str
    upload_url: str
    expires_in: int


class GenerateDownloadUrlResponse(BaseModel):
    bucket: str = Field(description='Bucket name')
    key: str = Field(description='Object key path')
    download_url: str = Field(description='Presigned URL for download')
    expires_in: int = Field(description='Expiration time in seconds')


class ObjectVersionItemResponse(BaseModel):
    version_id: str
    is_latest: bool
    last_modified: datetime
    size: int


class ListObjectVersionsResponse(BaseModel):
    bucket: str
    key: str
    versions: List[ObjectVersionItemResponse]


class DeleteObjectVersionResponse(BaseModel):
    bucket: str
    key: str
    version_id: Optional[str] = None
    message: str


class RestoreObjectVersionResponse(BaseModel):
    message: str
    bucket: str
    key: str
    restored_from_version: Optional[str] = None


class ObjectMetadataResponse(BaseModel):
    bucket: str
    key: str
    size: int
    etag: str
    last_modified: datetime
    content_type: Optional[str] = None
    metadata: Dict[str, str] = {}


class UpdateObjectTagsResponse(BaseModel):
    bucket: str
    key: str
    tags: Dict[str, str] = Field(default_factory=dict)
    message: str


class ObjectTagsResponse(BaseModel):
    bucket: str
    key: str
    tags: Dict[str, str] = Field(default_factory=dict)


class PresignedDownloadRequest(BaseModel):
    bucket: str
    key: str
    expires_in: int = 3600
    content_type: str | None = None
    download_as: str | None = None  # nome do arquivo


class ObjectMetadataRequest(BaseModel):
    bucket: str
    key: str


class UpdateObjectMetadataRequest(BaseModel):
    bucket: str
    key: str
    metadata: Dict[str, str]


class ObjectTagsRequest(BaseModel):
    bucket: str
    key: str


class UpdateObjectTagsRequest(BaseModel):
    bucket: str
    key: str
    tags: Dict[str, str]
