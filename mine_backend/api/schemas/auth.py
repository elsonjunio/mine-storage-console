from pydantic import BaseModel


class AuthResponseData(BaseModel):
    access_token: str
    token_type: str
    expires_in: int


class StandardResponse(BaseModel):
    success: bool
    data: AuthResponseData
