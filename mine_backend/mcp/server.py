from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from mine_backend.config import settings

_mcp_allowed_hosts = settings.MCP_ALLOWED_HOSTS
_mcp_allowed_origins = settings.MCP_ALLOWED_ORIGINS

if _mcp_allowed_hosts or _mcp_allowed_origins:
    _transport_security = TransportSecuritySettings(
        enable_dns_rebinding_protection=True,
        allowed_hosts=['127.0.0.1:*', 'localhost:*', '[::1]:*']
        + _mcp_allowed_hosts,
        allowed_origins=[
            'http://127.0.0.1:*',
            'http://localhost:*',
            'http://[::1]:*',
        ]
        + _mcp_allowed_origins,
    )
else:
    _transport_security = TransportSecuritySettings(
        enable_dns_rebinding_protection=False
    )

mcp = FastMCP('mine-mcp', transport_security=_transport_security)

# import tools
from mine_backend.mcp.tools import bucket_tools
from mine_backend.mcp.tools import object_tools
from mine_backend.mcp.tools import policy_tools
from mine_backend.mcp.tools import quota_tools
from mine_backend.mcp.tools import user_tools
from mine_backend.mcp.tools import group_tools
from mine_backend.mcp.tools import credential_tools
from mine_backend.mcp.tools import admin_notification_tools
