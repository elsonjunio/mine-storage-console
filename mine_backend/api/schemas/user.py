from pydantic import BaseModel
from typing import List, Optional


class GroupMembership(BaseModel):
    name: str
    policies: Optional[List[str]] = None


class UserResponse(BaseModel):
    status: str
    access_key: Optional[str] = None
    member_of: Optional[List[GroupMembership]] = None


class CreateUserRequest(BaseModel):
    username: str
    password: str
