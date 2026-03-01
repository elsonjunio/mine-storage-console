import httpx
from mine_backend.config import settings
from mine_backend.core.security import verify_keycloak_token
from mine_backend.services.sts_service import assume_role_with_web_identity
from mine_backend.services.session_service import issue_internal_token
from mine_backend.core.security import verify_internal_session
from mine_backend.exceptions.application import InvalidTokenError


class AuthService:

    @staticmethod
    async def exchange_code(code: str, code_verifier: str, redirect_uri: str) -> dict:
        token_url = (
            f'{settings.KEYCLOAK_URL}/realms/{settings.KEYCLOAK_REALM}'
            '/protocol/openid-connect/token'
        )
        async with httpx.AsyncClient() as client:
            response = await client.post(
                token_url,
                data={
                    'grant_type': 'authorization_code',
                    'client_id': settings.KEYCLOAK_CLIENT_ID,
                    'client_secret': settings.KEYCLOAK_CLIENT_SECRET,
                    'redirect_uri': redirect_uri,
                    'code': code,
                    'code_verifier': code_verifier,
                },
            )
        if response.status_code != 200:
            raise InvalidTokenError('Keycloak code exchange failed')

        keycloak_token = response.json()['access_token']
        return await AuthService.authenticate(keycloak_token)

    @staticmethod
    async def authenticate(keycloak_token: str) -> dict:
        user_payload = await verify_keycloak_token(keycloak_token)

        sts_data = await assume_role_with_web_identity(keycloak_token)

        internal_token = issue_internal_token(user_payload, sts_data)

        return {
            "internal_token": internal_token,
            "user": user_payload,
        }
    
    @staticmethod
    def get_current_user_from_internal_token(token: str) -> dict:
        return verify_internal_session(token)
