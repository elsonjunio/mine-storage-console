from mcp.server.fastmcp import FastMCP

mcp = FastMCP("mine-mcp")

# import tools
from mine_backend.mcp.tools import bucket_tools
from mine_backend.mcp.tools import object_tools
from mine_backend.mcp.tools import policy_tools
from mine_backend.mcp.tools import quota_tools
from mine_backend.mcp.tools import user_tools
from mine_backend.mcp.tools import group_tools
from mine_backend.mcp.tools import credential_tools
from mine_backend.mcp.tools import admin_notification_tools
