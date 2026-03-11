from mine_backend.mcp.server import mcp
from mine_backend.mcp.context import build_user_service, require_admin


@mcp.tool()
def list_users(token: str):
    """List all storage users. Admin only.

    Args:
        token: Internal session token. Caller must hold the admin role.

    Returns a list of user objects each with 'username', 'status', and 'policies'.
    """
    require_admin(token)
    service = build_user_service()
    return service.list_users()


@mcp.tool()
def get_user(token: str, username: str):
    """Get details for a specific storage user. Admin only.

    Args:
        token: Internal session token. Caller must hold the admin role.
        username: The storage username to retrieve.
    """
    require_admin(token)
    service = build_user_service()
    return service.get_user(username)


@mcp.tool()
def create_user(token: str, username: str, password: str):
    """Create a new storage user. Admin only.

    Args:
        token: Internal session token. Caller must hold the admin role.
        username: Desired username for the new storage user.
        password: Initial password (secret key) for the new user.
    """
    require_admin(token)
    service = build_user_service()
    return service.create_user(username, password)


@mcp.tool()
def delete_user(token: str, username: str):
    """Delete a storage user. Admin only.

    Args:
        token: Internal session token. Caller must hold the admin role.
        username: Username of the storage user to delete.
    """
    require_admin(token)
    service = build_user_service()
    return service.delete_user(username)


@mcp.tool()
def enable_user(token: str, username: str):
    """Enable a previously disabled storage user, restoring their access. Admin only.

    Args:
        token: Internal session token. Caller must hold the admin role.
        username: Username of the storage user to enable.
    """
    require_admin(token)
    service = build_user_service()
    return service.enable_user(username)


@mcp.tool()
def disable_user(token: str, username: str):
    """Disable a storage user, immediately revoking their storage access. Admin only.

    The user record is preserved; use enable_user to restore access.

    Args:
        token: Internal session token. Caller must hold the admin role.
        username: Username of the storage user to disable.
    """
    require_admin(token)
    service = build_user_service()
    return service.disable_user(username)
