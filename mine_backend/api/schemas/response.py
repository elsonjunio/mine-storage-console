from pydantic import BaseModel
from typing import Generic, TypeVar, Optional

from typing_extensions import TypedDict


T = TypeVar('T')


class Error(TypedDict):
    code: str
    message: str


class StandardResponse(BaseModel, Generic[T]):
    success: bool
    data: Optional[T] = None
    error: Optional[Error] = None
