from typing import List

from mine_backend.mcp.server import mcp
from mine_backend.mcp.context import build_group_service, require_admin


@mcp.tool()
def list_groups(token: str):
    """List all storage groups. Admin only.

    Args:
        token: Internal session token. Caller must hold the admin role.

    Returns a list of group summary objects each with 'name' and 'status'.
    """
    require_admin(token)
    service = build_group_service()
    return service.list_groups()


@mcp.tool()
def get_group(token: str, name: str):
    """Get details for a specific storage group. Admin only.

    Args:
        token: Internal session token. Caller must hold the admin role.
        name: Group name to retrieve.

    Returns an object with 'name', 'status', 'members' (list of usernames),
    and 'policies' (list of attached policy names).
    """
    require_admin(token)
    service = build_group_service()
    return service.get_group(name)


@mcp.tool()
def create_group(token: str, name: str, users: List[str]):
    """Create a new storage group. Admin only.

    Args:
        token: Internal session token. Caller must hold the admin role.
        name: Unique group name.
        users: List of existing storage usernames to add as initial members.
               Pass an empty list to create a group with no members.
    """
    require_admin(token)
    service = build_group_service()
    return service.create_group(name, users)


@mcp.tool()
def delete_group(token: str, name: str):
    """Delete a storage group. Admin only.

    Args:
        token: Internal session token. Caller must hold the admin role.
        name: Group name to delete.
    """
    require_admin(token)
    service = build_group_service()
    return service.delete_group(name)


@mcp.tool()
def add_users_to_group(token: str, name: str, users: List[str]):
    """Add one or more users to an existing storage group. Admin only.

    Args:
        token: Internal session token. Caller must hold the admin role.
        name: Group name to add users to.
        users: List of storage usernames to add.
    """
    require_admin(token)
    service = build_group_service()
    return service.add_users(name, users)


@mcp.tool()
def remove_users_from_group(token: str, name: str, users: List[str]):
    """Remove one or more users from a storage group. Admin only.

    Args:
        token: Internal session token. Caller must hold the admin role.
        name: Group name to remove users from.
        users: List of storage usernames to remove.
    """
    require_admin(token)
    service = build_group_service()
    return service.remove_users(name, users)


@mcp.tool()
def enable_group(token: str, name: str):
    """Enable a previously disabled storage group. Admin only.

    Members of the group will regain access to the group's attached policies.

    Args:
        token: Internal session token. Caller must hold the admin role.
        name: Group name to enable.
    """
    require_admin(token)
    service = build_group_service()
    return service.enable_group(name)


@mcp.tool()
def disable_group(token: str, name: str):
    """Disable a storage group, suspending its policy inheritance for all members. Admin only.

    Members are not deleted; re-enable the group to restore access.

    Args:
        token: Internal session token. Caller must hold the admin role.
        name: Group name to disable.
    """
    require_admin(token)
    service = build_group_service()
    return service.disable_group(name)


@mcp.tool()
def attach_policy_to_group(token: str, group: str, policy: str):
    """Attach a storage policy to a group. Admin only.

    All current and future members of the group will inherit the policy.

    Args:
        token: Internal session token. Caller must hold the admin role.
        group: Group name to attach the policy to.
        policy: Name of an existing storage policy to attach.
    """
    require_admin(token)
    service = build_group_service()
    return service.attach_policy(group, policy)


@mcp.tool()
def detach_policy_from_group(token: str, group: str, policy: str):
    """Detach a storage policy from a group. Admin only.

    Args:
        token: Internal session token. Caller must hold the admin role.
        group: Group name to detach the policy from.
        policy: Name of the policy to detach.
    """
    require_admin(token)
    service = build_group_service()
    return service.detach_policy(group, policy)


@mcp.tool()
def get_group_policies(token: str, name: str):
    """List all policies attached to a storage group. Admin only.

    Args:
        token: Internal session token. Caller must hold the admin role.
        name: Group name to retrieve policies for.
    """
    require_admin(token)
    service = build_group_service()
    return service.get_attach_policy(name)
