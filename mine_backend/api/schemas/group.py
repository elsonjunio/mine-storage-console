from pydantic import BaseModel
from typing import List, Optional


class GroupListResponse(BaseModel):
    groups: Optional[List[str]] = None


class GroupResponse(BaseModel):
    status: str
    group_name: str
    members: Optional[List[str]] = None


class GroupPolicyReponse(BaseModel):
    status: str
    group: str
    policies_attached: Optional[List[str]] = None


# ---


class GroupMappingsReponse(BaseModel):
    group: str
    policies: Optional[List[str]] = None


class ResultGroupMappingsReponse(BaseModel):
    timestamp: str
    group_mappings: Optional[List[GroupMappingsReponse]] = None


class GroupPolicyMappReponse(BaseModel):
    result: Optional[ResultGroupMappingsReponse] = None


class CreateGroupRequest(BaseModel):
    name: str
    users: List[str] = []


class GroupUsersRequest(BaseModel):
    name: str
    users: List[str]


class DeleteGroupUsersRequest(BaseModel):
    users: List[str]


class GroupPolicyRequest(BaseModel):
    group: str
    policy: str


# --


class GroupPolicyDeatached(BaseModel):
    group: str
    policies_detached: Optional[List[str]] = None


class GroupPolicyAttached(BaseModel):
    group: str
    policies_attached: Optional[List[str]] = None
