from fastapi import Depends

from mine_backend.api.dependencies.auth import get_current_user
from mine_backend.services.authorization_service import AuthorizationService


def require_role(required_role: str):

    async def role_dependency(user: dict = Depends(get_current_user)):
        return AuthorizationService.require_role(
            user,
            required_role,
        )

    return role_dependency
