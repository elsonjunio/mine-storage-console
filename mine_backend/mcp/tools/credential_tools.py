from typing import Optional

from mine_backend.mcp.server import mcp
from mine_backend.mcp.context import build_credential_service, require_admin


@mcp.tool()
def list_credentials(token: str, username: str):
    """List all service account credentials for a storage user. Admin only.

    Args:
        token: Internal session token. Caller must hold the admin role.
        username: Storage username whose credentials to list.

    Returns a list of credential objects each with 'access_key', 'status',
    and 'expiration' (null if the credential does not expire).
    """
    require_admin(token)
    service = build_credential_service()
    return service.list_credentials(username)


@mcp.tool()
def create_credential(
    token: str,
    username: str,
    policy: dict,
    expiration: Optional[str] = None,
):
    """Create a new service account credential for a storage user. Admin only.

    Args:
        token: Internal session token. Caller must hold the admin role.
        username: Storage username to create the credential for.
        policy: IAM-style policy document to scope the credential's permissions.
                Must contain 'Version' and 'Statement' keys. The credential will
                only have permissions granted by this document, regardless of
                the user's own policies.
        expiration: Optional expiry as an ISO-8601 datetime string, e.g.
                    '2026-12-31T23:59:59Z'. If omitted, the credential does
                    not expire.

    Returns an object with 'access_key' and 'secret_key'. The secret key is
    only returned once and cannot be retrieved again.
    """
    require_admin(token)
    service = build_credential_service()
    return service.create_credential(username, policy, expiration)


@mcp.tool()
def delete_credential(token: str, access_key: str):
    """Delete a service account credential by its access key. Admin only.

    Args:
        token: Internal session token. Caller must hold the admin role.
        access_key: The access key of the credential to delete. Obtain from
                    list_credentials.
    """
    require_admin(token)
    service = build_credential_service()
    return service.delete_credential(access_key)
