from typing import List, Optional, Dict
from pydantic import BaseModel


class ConfigKeyValue(BaseModel):
    key: str
    value: str


class SubSystemConfig(BaseModel):
    subSystem: str
    target: Optional[str] = None
    kv: List[ConfigKeyValue]


class NotificationConfigResponse(BaseModel):
    status: str
    config: List[SubSystemConfig]

class CreateWebhookRequest(BaseModel):
    identifier: str
    config: Dict