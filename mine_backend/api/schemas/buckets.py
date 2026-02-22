from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from typing import Dict, Any


class BucketResponse(BaseModel):
    name: str
    creation_date: datetime


class BucketStatusResponse(BaseModel):
    message: str
    bucket: Optional[str] = None


class BucketVersionResponse(BaseModel):
    bucket: str
    versioning: str


class BucketQuotaResponse(BaseModel):
    bucket: str
    quota: str
    raw: Optional[List[dict]]


class BucketQuotaGetResponse(BaseModel):
    bucket: str
    type: str
    quota_bytes: int


class BucketUsageResponse(BaseModel):
    bucket: str
    objects: int
    size_bytes: int


class BucketPolicyResponse(BaseModel):
    bucket: str
    policy: Optional[dict]


class UpdateBucketPolicyRequest(BaseModel):
    policy: Dict[str, Any]


class UpdateBucketLifecycleRequest(BaseModel):
    lifecycle: Dict[str, Any]
