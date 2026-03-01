from mine_backend.core.authorization import validate_role, is_admin


class AuthorizationService:

    @staticmethod
    def require_role(user: dict, required_role: str) -> dict:
        validate_role(user, required_role)
        return user
    
    @staticmethod
    def is_admin(user: dict) -> dict:
        return is_admin(user)
        
