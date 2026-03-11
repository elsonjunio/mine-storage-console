from mine_backend.mcp.server import mcp
from mine_backend.mcp.context import build_bucket_service_from_session, require_admin


@mcp.tool()
def get_quotas_overview(token: str):
    """Get a usage and quota overview across all buckets. Admin only.

    Args:
        token: Internal session token. Caller must hold the admin role.

    Returns a list of per-bucket objects each with 'name', 'size_bytes',
    'objects' (count), 'quota_bytes' (null if no quota), and
    'usage_percent' (null if no quota is set).
    """
    session = require_admin(token)
    service = build_bucket_service_from_session(session)
    return service.get_quotas_overview()


@mcp.tool()
def set_global_quota(token: str, quota_bytes: int):
    """Apply the same storage quota to every bucket. Admin only.

    Args:
        token: Internal session token. Caller must hold the admin role.
        quota_bytes: Quota in bytes to apply to all buckets. Must be > 0.

    Returns an object with 'applied' (count of buckets updated) and
    'errors' (list of bucket names that could not be updated).
    """
    session = require_admin(token)
    service = build_bucket_service_from_session(session)
    return service.set_global_quota(quota_bytes)


@mcp.tool()
def remove_bucket_quota(token: str, name: str):
    """Remove the storage quota from a specific bucket. Admin only.

    After removal the bucket has no size limit (beyond the server-level cap).

    Args:
        token: Internal session token. Caller must hold the admin role.
        name: Bucket name to remove the quota from.
    """
    session = require_admin(token)
    service = build_bucket_service_from_session(session)
    return service.remove_quota(name)
