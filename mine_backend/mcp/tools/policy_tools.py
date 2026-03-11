from mine_backend.mcp.server import mcp
from mine_backend.mcp.context import build_policy_service, require_admin


@mcp.tool()
def list_policies(token: str):
    """List all storage policies. Admin only.

    Args:
        token: Internal session token. Caller must hold the admin role.

    Returns a list of policy objects each with 'name' and 'policy' (IAM document).
    """
    require_admin(token)
    service = build_policy_service()
    return service.list_policies()


@mcp.tool()
def get_policy(token: str, name: str):
    """Get a storage policy by name. Admin only.

    Args:
        token: Internal session token. Caller must hold the admin role.
        name: Exact policy name.
    """
    require_admin(token)
    service = build_policy_service()
    return service.get_policy(name)


@mcp.tool()
def get_policy_groups(token: str, name: str):
    """Get all groups that have a given storage policy attached. Admin only.

    Args:
        token: Internal session token. Caller must hold the admin role.
        name: Policy name to look up group memberships for.

    Returns an object with 'policy' and 'groups' (list of group name strings).
    """
    require_admin(token)
    service = build_policy_service()
    groups = service.get_groups_by_policy(name)
    return {'policy': name, 'groups': groups or []}


@mcp.tool()
def create_policy(token: str, name: str, document: dict):
    """Create a new storage policy. Admin only.

    Args:
        token: Internal session token. Caller must hold the admin role.
        name: Unique policy name.
        document: IAM-style policy document. Must contain 'Version' (e.g.
                  '2012-10-17') and 'Statement' (list of statement objects).
                  Each statement needs 'Effect' ('Allow'/'Deny'), 'Action'
                  (list of s3:* actions), and 'Resource' (ARN or list of ARNs).
    """
    require_admin(token)
    service = build_policy_service()
    return service.create_policy(name, document)


@mcp.tool()
def delete_policy(token: str, name: str):
    """Delete a storage policy by name. Admin only.

    Detach the policy from all users/groups before deleting it.

    Args:
        token: Internal session token. Caller must hold the admin role.
        name: Policy name to delete.
    """
    require_admin(token)
    service = build_policy_service()
    return service.delete_policy(name)


@mcp.tool()
def attach_policy(token: str, policy: str, username: str):
    """Attach a storage policy to a user. Admin only.

    Args:
        token: Internal session token. Caller must hold the admin role.
        policy: Name of the policy to attach.
        username: Username of the storage user to attach the policy to.
    """
    require_admin(token)
    service = build_policy_service()
    return service.attach_policy(policy, username)


@mcp.tool()
def detach_policy(token: str, policy: str, username: str):
    """Detach a storage policy from a user. Admin only.

    Args:
        token: Internal session token. Caller must hold the admin role.
        policy: Name of the policy to detach.
        username: Username of the storage user to detach the policy from.
    """
    require_admin(token)
    service = build_policy_service()
    return service.detach_policy(policy, username)
