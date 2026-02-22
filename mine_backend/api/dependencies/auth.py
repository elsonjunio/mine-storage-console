from fastapi import Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from mine_backend.services.auth_service import AuthService


security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    token = credentials.credentials
    return AuthService.get_current_user_from_internal_token(
        token
    )
