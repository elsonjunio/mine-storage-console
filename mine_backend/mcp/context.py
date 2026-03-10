from mine_backend.services.bucket_service import BucketService
from mine_backend.config import get_admin
from mine_backend.config import get_s3_client

from mine_backend.core.security import extract_sts_credentials

from mine_backend.services.auth_service import AuthService


def get_current_user(
    token,
):
    return AuthService.get_current_user_from_internal_token(token)


def build_bucket_service_from_token(token: str):
    session = get_current_user(token)
    sts = extract_sts_credentials(session)
    s3_client = get_s3_client(sts)
    storage_admin = get_admin()
    return BucketService(s3_client, storage_admin)
