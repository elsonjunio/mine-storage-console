from mine_backend.mcp.server import mcp
from mine_backend.mcp.context import (
    build_bucket_service_from_token,
    build_bucket_service_from_session,
    require_admin,
)


@mcp.tool()
def list_buckets(token: str):
    """List all buckets visible to the authenticated user.

    Args:
        token: Internal session token obtained after login.

    Returns a list of objects with 'name' and 'creation_date'.
    """
    service = build_bucket_service_from_token(token)
    return service.list_buckets()


@mcp.tool()
def create_bucket(token: str, name: str):
    """Create a new bucket.

    Args:
        token: Internal session token obtained after login.
        name: Bucket name. Must be 3–63 lowercase alphanumeric characters,
              hyphens, or dots. Cannot start or end with a hyphen/dot.
    """
    service = build_bucket_service_from_token(token)
    return service.create_bucket(name)


@mcp.tool()
def delete_bucket(token: str, name: str):
    """Delete an existing bucket.

    Args:
        token: Internal session token obtained after login.
        name: Name of the bucket to delete. The bucket must be empty.
    """
    service = build_bucket_service_from_token(token)
    return service.delete_bucket(name)


@mcp.tool()
def get_bucket_versioning(token: str, name: str):
    """Get the versioning status of a bucket.

    Args:
        token: Internal session token obtained after login.
        name: Bucket name.

    Returns an object with 'bucket' and 'versioning' ('enabled', 'suspended', or 'disabled').
    """
    service = build_bucket_service_from_token(token)
    return service.get_versioning(name)


@mcp.tool()
def set_bucket_versioning(token: str, name: str, enabled: bool):
    """Enable or suspend versioning on a bucket.

    Args:
        token: Internal session token obtained after login.
        name: Bucket name.
        enabled: True to enable versioning, False to suspend it.
                 Versioning cannot be fully disabled once enabled.
    """
    service = build_bucket_service_from_token(token)
    return service.set_versioning(name, enabled)


@mcp.tool()
def get_bucket_quota(token: str, name: str):
    """Get the storage quota configured for a bucket. Admin only.

    Args:
        token: Internal session token. Caller must hold the admin role.
        name: Bucket name.
    """
    session = require_admin(token)
    service = build_bucket_service_from_session(session)
    return service.get_quota(name)


@mcp.tool()
def set_bucket_quota(token: str, name: str, quota_bytes: int):
    """Set a storage quota for a bucket.

    Args:
        token: Internal session token obtained after login.
        name: Bucket name.
        quota_bytes: Maximum allowed storage in bytes. Must be greater than 0.
    """
    session = require_admin(token)
    service = build_bucket_service_from_session(session)
    return service.set_quota(name, quota_bytes)


@mcp.tool()
def get_bucket_usage(token: str, name: str):
    """Get current storage usage for a bucket.

    Args:
        token: Internal session token. Caller must hold the admin role.
        name: Bucket name.

    Returns an object with 'bucket', 'objects' (count), and 'size_bytes'.
    """
    service = build_bucket_service_from_token(token)
    return service.get_usage(name)


@mcp.tool()
def get_bucket_policy(token: str, name: str):
    """Retrieve the S3 bucket policy document for a bucket.

    Args:
        token: Internal session token obtained after login.
        name: Bucket name.

    Returns an object with 'bucket' and 'policy' (IAM policy dict, or null if none set).
    """
    service = build_bucket_service_from_token(token)
    return service.get_bucket_policy(name)


@mcp.tool()
def put_bucket_policy(token: str, name: str, policy: dict):
    """Apply an S3 bucket policy to a bucket, replacing any existing policy.

    Args:
        token: Internal session token obtained after login.
        name: Bucket name.
        policy: IAM-style policy document as a dict. Must include 'Version'
                and 'Statement' keys. Example statement grants public read:
                {"Effect":"Allow","Principal":"*","Action":"s3:GetObject","Resource":"arn:aws:s3:::bucket/*"}
    """
    service = build_bucket_service_from_token(token)
    return service.put_bucket_policy(name, policy)


@mcp.tool()
def delete_bucket_policy(token: str, name: str):
    """Remove the bucket policy from a bucket, reverting to private access.

    Args:
        token: Internal session token obtained after login.
        name: Bucket name.
    """
    service = build_bucket_service_from_token(token)
    return service.delete_bucket_policy(name)


@mcp.tool()
def validate_bucket_policy(token: str, name: str, policy: dict):
    """Validate an S3 bucket policy document without applying it.

    Args:
        token: Internal session token obtained after login.
        name: Bucket name (used for context only, policy is not applied).
        policy: IAM-style policy document to validate.

    Returns an object with 'valid' (bool) and 'errors' (list of strings).
    """
    service = build_bucket_service_from_token(token)
    return service.validate_policy(policy)


@mcp.tool()
def get_bucket_lifecycle(token: str, name: str):
    """Retrieve the lifecycle configuration for a bucket.

    Args:
        token: Internal session token obtained after login.
        name: Bucket name.

    Returns an object with 'bucket' and 'lifecycle' containing the Rules array.
    """
    service = build_bucket_service_from_token(token)
    return service.get_bucket_lifecycle(name)


@mcp.tool()
def put_bucket_lifecycle(token: str, name: str, lifecycle: dict):
    """Apply a lifecycle configuration to a bucket, replacing any existing rules.

    Args:
        token: Internal session token obtained after login.
        name: Bucket name.
        lifecycle: Lifecycle configuration dict. Must contain a 'Rules' key
                   with a list of rule objects. Each rule requires 'ID', 'Status'
                   ('Enabled' or 'Disabled'), 'Filter', and at least one action
                   (e.g. 'Expiration', 'NoncurrentVersionExpiration').
    """
    service = build_bucket_service_from_token(token)
    return service.put_bucket_lifecycle(name, lifecycle)


@mcp.tool()
def delete_bucket_lifecycle(token: str, name: str):
    """Remove the lifecycle configuration from a bucket.

    Args:
        token: Internal session token obtained after login.
        name: Bucket name.
    """
    service = build_bucket_service_from_token(token)
    return service.delete_bucket_lifecycle(name)


@mcp.tool()
def validate_bucket_lifecycle(token: str, name: str, lifecycle: dict):
    """Validate a lifecycle configuration without applying it.

    Args:
        token: Internal session token obtained after login.
        name: Bucket name (used for context only, config is not applied).
        lifecycle: Lifecycle configuration dict to validate (see put_bucket_lifecycle).

    Returns an object with 'valid' (bool) and 'errors' (list of strings).
    """
    service = build_bucket_service_from_token(token)
    return service.validate_lifecycle(lifecycle)


@mcp.tool()
def get_bucket_events(token: str, name: str):
    """Retrieve the event notification configuration for a bucket.

    Args:
        token: Internal session token obtained after login.
        name: Bucket name.

    Returns an object with 'bucket' and 'events' containing any of:
    'QueueConfigurations', 'TopicConfigurations', 'LambdaFunctionConfigurations'.
    """
    service = build_bucket_service_from_token(token)
    return service.get_bucket_events(name)


@mcp.tool()
def put_bucket_events(token: str, name: str, config: dict):
    """Apply an event notification configuration to a bucket.

    Args:
        token: Internal session token obtained after login.
        name: Bucket name.
        config: Notification configuration dict. May contain keys
                'QueueConfigurations', 'TopicConfigurations', and/or
                'LambdaFunctionConfigurations', each a list of rule objects.
    """
    service = build_bucket_service_from_token(token)
    return service.put_bucket_events(name, config)


@mcp.tool()
def delete_bucket_events(token: str, name: str):
    """Remove all event notification configurations from a bucket.

    Args:
        token: Internal session token obtained after login.
        name: Bucket name.
    """
    service = build_bucket_service_from_token(token)
    return service.delete_bucket_events(name)
