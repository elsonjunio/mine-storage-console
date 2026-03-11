from mine_backend.mcp.server import mcp
from mine_backend.mcp.context import build_admin_notification_service, require_admin


@mcp.tool()
def list_admin_notification_targets(token: str, type: str):
    """List all configured notification targets of a given type. Admin only.

    Args:
        token: Internal session token. Caller must hold the admin role.
        type: Target type to list. Common values: 'webhook', 'kafka', 'amqp',
              'mqtt', 'nats', 'elasticsearch', 'redis'.

    Returns a list of target configuration objects.
    """
    require_admin(token)
    service = build_admin_notification_service()
    return service.list_targets(type)


@mcp.tool()
def create_admin_notification_target(token: str, type: str, identifier: str, config: dict):
    """Create a new notification target. Admin only.

    Args:
        token: Internal session token. Caller must hold the admin role.
        type: Target type (e.g. 'webhook', 'kafka', 'amqp'). Must match a
              supported MinIO notification endpoint type.
        identifier: Unique identifier for this target within its type (e.g. '1',
                    'primary'). Used to reference the target in bucket event rules.
        config: Provider-specific connection settings as a dict. Required keys
                vary by type — for 'webhook': {'endpoint': 'https://...'},
                for 'kafka': {'brokers': ['host:port'], 'topic': 'name'}.
    """
    require_admin(token)
    service = build_admin_notification_service()
    return service.create_target(type, identifier, config)


@mcp.tool()
def delete_admin_notification_target(token: str, type: str, identifier: str):
    """Delete a notification target by type and identifier. Admin only.

    Args:
        token: Internal session token. Caller must hold the admin role.
        type: Target type (e.g. 'webhook', 'kafka').
        identifier: Identifier of the target to delete (as given when created).
    """
    require_admin(token)
    service = build_admin_notification_service()
    return service.delete_target(type, identifier)
