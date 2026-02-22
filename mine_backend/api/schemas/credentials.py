from pydantic import BaseModel


class CredentialsResponse(BaseModel):
    access_key: str


class CreatedCredentialsResponse(BaseModel):
    status: str
    access_key: str
    secret_key: str
    expiration: str


class CreateCredentialRequest(BaseModel):
    username: str
    policy: dict | None = None
    expiration: str | None = None 