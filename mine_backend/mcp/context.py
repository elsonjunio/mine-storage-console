from mine_backend.services.bucket_service import BucketService
from mine_backend.services.object_service import ObjectService
from mine_backend.services.policy_service import PolicyService
from mine_backend.services.user_service import UserService
from mine_backend.services.group_service import GroupService
from mine_backend.services.credential_service import CredentialService
from mine_backend.services.admin_notification_service import (
    AdminNotificationService,
)
from mine_backend.config import get_admin
from mine_backend.config import get_s3_client
from mine_backend.core.authorization import is_admin as u_is_admin
from mine_backend.core.security import extract_sts_credentials
from mine_backend.exceptions.application import PermissionDeniedError
from mine_backend.services.auth_service import AuthService


def get_current_user(token: str) -> dict:
    return AuthService.get_current_user_from_internal_token(token)


def require_admin(token: str) -> dict:
    """Decode the token, enforce admin role, and return the session.

    Raises PermissionDeniedError if the user does not hold the admin role.
    Returns the decoded session so callers can reuse it without a second decode.
    """
    session = get_current_user(token)
    if not u_is_admin(session):
        raise PermissionDeniedError('Missing required role: admin')
    return session


def build_bucket_service_from_token(token: str) -> BucketService:
    session = get_current_user(token)
    return build_bucket_service_from_session(session)


def build_bucket_service_from_session(session: dict) -> BucketService:
    sts = extract_sts_credentials(session)
    s3_client = get_s3_client(sts)
    storage_admin = get_admin()
    return BucketService(s3_client, storage_admin)


def build_object_service_from_token(token: str) -> ObjectService:
    session = get_current_user(token)
    sts = extract_sts_credentials(session)
    s3_client = get_s3_client(sts)
    return ObjectService(s3_client)


def build_policy_service() -> PolicyService:
    return PolicyService(get_admin())


def build_user_service() -> UserService:
    return UserService(get_admin())


def build_group_service() -> GroupService:
    return GroupService(get_admin())


def build_credential_service() -> CredentialService:
    return CredentialService(get_admin())


def build_admin_notification_service() -> AdminNotificationService:
    return AdminNotificationService(get_admin())
