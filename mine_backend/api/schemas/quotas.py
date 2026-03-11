from pydantic import BaseModel
from typing import List, Optional


class QuotaBucketRow(BaseModel):
    name: str
    size_bytes: int
    objects: int
    quota_bytes: Optional[int] = None
    usage_percent: Optional[float] = None


class GlobalQuotaRequest(BaseModel):
    quota_bytes: int


class GlobalQuotaResponse(BaseModel):
    applied: int
    errors: List[str]
