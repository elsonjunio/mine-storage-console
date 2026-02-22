from mine_backend.core.authorization import validate_role


class AuthorizationService:

    @staticmethod
    def require_role(user: dict, required_role: str) -> dict:
        validate_role(user, required_role)
        return user
