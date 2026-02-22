from fastapi import APIRouter, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from mine_backend.services.auth_service import AuthService
from mine_backend.config import settings

from mine_backend.api.schemas.auth import StandardResponse

router = APIRouter(prefix='/auth', tags=['auth'])
security = HTTPBearer()


@router.post('/', response_model=StandardResponse)
async def authenticate(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    keycloak_token = credentials.credentials

    result = await AuthService.authenticate(keycloak_token)

    return {
        'success': True,
        'data': {
            'access_token': result['internal_token'],
            'token_type': 'bearer',
            'expires_in': settings.INTERNAL_TOKEN_EXP_MINUTES * 60,
        },
    }
