from pydantic import BaseModel


class CallbackRequest(BaseModel):
    code: str
    code_verifier: str
    redirect_uri: str


class AuthResponseData(BaseModel):
    access_token: str
    token_type: str
    expires_in: int


class StandardResponse(BaseModel):
    success: bool
    data: AuthResponseData
