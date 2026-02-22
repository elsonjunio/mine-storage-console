from mine_backend.core.security import verify_keycloak_token
from mine_backend.services.sts_service import assume_role_with_web_identity
from mine_backend.services.session_service import issue_internal_token
from mine_backend.core.security import verify_internal_session


class AuthService:

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
