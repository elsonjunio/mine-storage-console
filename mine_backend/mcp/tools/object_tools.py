from typing import Optional

from mine_backend.mcp.server import mcp
from mine_backend.mcp.context import build_object_service_from_token


@mcp.tool()
def list_objects(
    token: str,
    bucket: str,
    prefix: Optional[str] = None,
    limit: int = 100,
    continuation_token: Optional[str] = None,
):
    """List objects in a bucket, optionally filtered by a key prefix.

    Args:
        token: Internal session token obtained after login.
        bucket: Bucket name to list objects from.
        prefix: Optional key prefix to filter results (e.g. 'images/' lists
                only objects whose key starts with 'images/').
        limit: Maximum number of objects to return (1–1000, default 100).
        continuation_token: Opaque token from a previous response's
                            'next_continuation_token' field for pagination.

    Returns an object with 'objects' list, 'is_truncated' (bool), and
    'next_continuation_token' (present when is_truncated is true).
    """
    service = build_object_service_from_token(token)
    return service.list_objects(bucket, prefix, limit, continuation_token)


@mcp.tool()
def delete_object(token: str, bucket: str, key: str):
    """Delete an object from a bucket.

    Args:
        token: Internal session token obtained after login.
        bucket: Bucket name.
        key: Full object key (path) to delete, e.g. 'folder/file.txt'.
    """
    service = build_object_service_from_token(token)
    return service.delete_object(bucket, key)


@mcp.tool()
def copy_object(
    token: str,
    source_bucket: str,
    source_key: str,
    dest_bucket: str,
    dest_key: str,
):
    """Copy an object from one location to another. The source is not modified.

    Args:
        token: Internal session token obtained after login.
        source_bucket: Bucket containing the object to copy.
        source_key: Full key of the object to copy.
        dest_bucket: Destination bucket (may be the same as source_bucket).
        dest_key: Destination key for the copied object.
    """
    service = build_object_service_from_token(token)
    return service.copy_object(source_bucket, source_key, dest_bucket, dest_key)


@mcp.tool()
def move_object(
    token: str,
    source_bucket: str,
    source_key: str,
    dest_bucket: str,
    dest_key: str,
):
    """Move an object by copying it to a new location then deleting the source.

    Args:
        token: Internal session token obtained after login.
        source_bucket: Bucket containing the object to move.
        source_key: Full key of the object to move.
        dest_bucket: Destination bucket (may be the same as source_bucket).
        dest_key: Destination key for the moved object.
    """
    service = build_object_service_from_token(token)
    return service.move_object(source_bucket, source_key, dest_bucket, dest_key)


@mcp.tool()
def generate_upload_url(
    token: str,
    bucket: str,
    key: str,
    content_type: Optional[str] = None,
    expires_in: int = 3600,
):
    """Generate a presigned URL for uploading an object directly to storage.

    The caller must send an HTTP PUT request to the returned URL with the
    file body and a matching Content-Type header. The URL is single-use.

    Args:
        token: Internal session token obtained after login.
        bucket: Destination bucket name.
        key: Destination object key (path), e.g. 'uploads/photo.jpg'.
        content_type: MIME type of the file being uploaded (e.g. 'image/jpeg').
                      Must match the Content-Type header used in the PUT request.
        expires_in: URL validity in seconds (1–86400, default 3600).

    Returns an object with 'upload_url', 'bucket', 'key', and 'expires_in'.
    """
    service = build_object_service_from_token(token)
    return service.generate_upload_url(bucket, key, expires_in, content_type)


@mcp.tool()
def generate_download_url(
    token: str,
    bucket: str,
    key: str,
    expires_in: int = 3600,
    content_type: Optional[str] = None,
    download_as: Optional[str] = None,
):
    """Generate a presigned URL for downloading an object.

    Args:
        token: Internal session token obtained after login.
        bucket: Bucket name.
        key: Object key to download.
        expires_in: URL validity in seconds (1–86400, default 3600).
        content_type: Override the Content-Type header served with the download
                      (e.g. 'application/octet-stream' to force binary).
        download_as: If provided, the browser will prompt a Save As dialog
                     using this filename (sets Content-Disposition: attachment).

    Returns an object with 'download_url', 'bucket', 'key', and 'expires_in'.
    """
    disposition = None
    if download_as:
        disposition = f'attachment; filename="{download_as}"'

    service = build_object_service_from_token(token)
    return service.generate_download_url(
        bucket=bucket,
        key=key,
        expires_in=expires_in,
        response_content_type=content_type,
        response_content_disposition=disposition,
    )


@mcp.tool()
def list_object_versions(token: str, bucket: str, key: str):
    """List all stored versions of a specific object.

    Requires versioning to be enabled on the bucket.

    Args:
        token: Internal session token obtained after login.
        bucket: Bucket name.
        key: Object key to list versions for.

    Returns an object with 'versions', each entry having 'version_id',
    'is_latest', 'last_modified', and 'size'.
    """
    service = build_object_service_from_token(token)
    return service.list_object_versions(bucket, key)


@mcp.tool()
def delete_object_version(token: str, bucket: str, key: str, version_id: str):
    """Permanently delete a specific version of an object.

    Args:
        token: Internal session token obtained after login.
        bucket: Bucket name.
        key: Object key.
        version_id: Version ID to delete. Obtain from list_object_versions.
    """
    service = build_object_service_from_token(token)
    return service.delete_object_version(bucket, key, version_id)


@mcp.tool()
def restore_object_version(token: str, bucket: str, key: str, version_id: str):
    """Restore a previous version of an object as the current (latest) version.

    This copies the specified version to a new version, making it the latest.
    The previous versions are preserved.

    Args:
        token: Internal session token obtained after login.
        bucket: Bucket name.
        key: Object key.
        version_id: Version ID to restore. Obtain from list_object_versions.
    """
    service = build_object_service_from_token(token)
    return service.restore_object_version(bucket, key, version_id)


@mcp.tool()
def get_object_metadata(token: str, bucket: str, key: str):
    """Retrieve metadata for an object without downloading its content.

    Args:
        token: Internal session token obtained after login.
        bucket: Bucket name.
        key: Object key.

    Returns an object with 'size', 'etag', 'last_modified', 'content_type',
    and 'metadata' (dict of custom user-defined string key/value pairs).
    """
    service = build_object_service_from_token(token)
    return service.get_object_metadata(bucket, key)


@mcp.tool()
def update_object_metadata(token: str, bucket: str, key: str, metadata: dict):
    """Update the custom metadata on an object.

    This replaces all existing custom metadata. To remove all metadata, pass {}.
    Standard system metadata (size, etag, etc.) is not affected.

    Args:
        token: Internal session token obtained after login.
        bucket: Bucket name.
        key: Object key.
        metadata: Dict of string key/value pairs. Keys will be stored with the
                  x-amz-meta- prefix. Example: {"author": "alice", "env": "prod"}.
    """
    service = build_object_service_from_token(token)
    return service.update_object_metadata(bucket, key, metadata)


@mcp.tool()
def get_object_tags(token: str, bucket: str, key: str):
    """Retrieve the tags associated with an object.

    Args:
        token: Internal session token obtained after login.
        bucket: Bucket name.
        key: Object key.

    Returns an object with 'bucket', 'key', and 'tags' (dict of string key/value pairs).
    """
    service = build_object_service_from_token(token)
    return service.get_object_tags(bucket, key)


@mcp.tool()
def update_object_tags(token: str, bucket: str, key: str, tags: dict):
    """Replace the tags on an object. Existing tags are overwritten entirely.

    Args:
        token: Internal session token obtained after login.
        bucket: Bucket name.
        key: Object key.
        tags: Dict of string key/value pairs (max 10 tags, keys up to 128 chars,
              values up to 256 chars). Pass {} to clear all tags.
    """
    service = build_object_service_from_token(token)
    return service.update_object_tags(bucket, key, tags)
