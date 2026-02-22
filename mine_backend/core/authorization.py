from mine_backend.config import settings
from mine_backend.core.utils import get_nested_claim
from mine_backend.exceptions.application import PermissionDeniedError


def validate_role(user: dict, required_role: str) -> None:
    roles = get_nested_claim(user, settings.OPENID_ROLE_CLAIM)

    if not roles or required_role not in roles:
        raise PermissionDeniedError(
            f"Missing required role: {required_role}"
        )
