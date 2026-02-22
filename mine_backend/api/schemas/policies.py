from pydantic import BaseModel
from typing import List, Optional, Dict, Any


class PolicyInfoResponse(BaseModel):
    policy_name: str
    policy: Optional[Dict] = None
    create_date: Optional[str] = None
    update_date: Optional[str] = None


class PolicyResponse(BaseModel):
    policy: str
    is_group: bool
    policy_info: Optional[PolicyInfoResponse] = None

class PolicyAttachedResponse(BaseModel):
    policies_attached: Optional[List[str]] = None
    user: str

class PolicyDetachedResponse(BaseModel):
    policies_detached: Optional[List[str]] = None
    user: str


class CreatePolicyRequest(BaseModel):
    name: str
    document: Dict[str, Any]


class AttachPolicyRequest(BaseModel):
    policy: str
    username: str

