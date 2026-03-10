from mine_backend.mcp.server import mcp
from mine_backend.mcp.context import build_bucket_service_from_token


@mcp.tool()
def list_buckets(token: str):
    """
    List all buckets available to the authenticated user.
    """

    bucket_service = build_bucket_service_from_token(token)

    return bucket_service.list_buckets()