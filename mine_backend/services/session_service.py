from jose import jwt
from datetime import datetime, timedelta
from mine_backend.config import settings
from mine_backend.core.utils import get_claim


def issue_internal_token(user_payload: dict, sts_data: dict):

    expire = datetime.utcnow() + timedelta(
        minutes=settings.INTERNAL_TOKEN_EXP_MINUTES
    )

    custom_roles = get_claim(user_payload, settings.OPENID_ROLE_CLAIM)

    payload = {
        "sub": user_payload.get("sub"),
        "username": user_payload.get("preferred_username"),
        "roles": user_payload.get("realm_access", {}).get("roles", []),
        "sts": sts_data,
        "type": "mine_session",
        "exp": expire,
    }

    payload.update(custom_roles)

    return jwt.encode(
        payload,
        settings.INTERNAL_TOKEN_SECRET,
        algorithm="HS256",
    )


def decode_internal_token(token: str):
    return jwt.decode(
        token,
        settings.INTERNAL_TOKEN_SECRET,
        algorithms=["HS256"],
    )
