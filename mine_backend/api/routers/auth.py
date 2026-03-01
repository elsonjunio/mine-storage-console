from fastapi import APIRouter, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from mine_backend.services.auth_service import AuthService
from mine_backend.config import settings

from mine_backend.api.schemas.auth import CallbackRequest, StandardResponse

router = APIRouter(prefix='/auth', tags=['auth'])
security = HTTPBearer()


@router.post('/callback', response_model=StandardResponse)
async def auth_callback(body: CallbackRequest):
    result = await AuthService.exchange_code(
        code=body.code,
        code_verifier=body.code_verifier,
        redirect_uri=body.redirect_uri,
    )
    return {
        'success': True,
        'data': {
            'access_token': result['internal_token'],
            'token_type': 'bearer',
            'expires_in': settings.INTERNAL_TOKEN_EXP_MINUTES * 60,
        },
    }


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
