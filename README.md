
# MINE

> Documentação em português: [README.pt-BR.md](README.pt-BR.md)

## What is MINE?

MINE stands for **MINE Is Not Enterprise**.

It is intentionally designed as a lightweight, clean, non-enterprise storage management platform.

MINE will never aim to become an enterprise product.
However, it is licensed under MIT to ensure anyone is free to fork, extend, or commercialize it under their own terms.

---

## 🏗 Architecture

MINE follows Clean Architecture principles and is organized into distinct layers:

* **Domain contracts** (`mine-spec`)
* **Infrastructure adapters** (e.g., MinIO)
* **Backend service (this repository)**
* **Frontend dashboard (in progress)**

The backend depends only on abstract contracts and remains provider-agnostic.

---

## 📦 Current Status

At the moment, this repository contains:

* ✅ Backend service
* ✅ MCP server
* ✅ Frontend

The frontend dashboard is being developed separately and will provide a user interface for storage management.

---

## 🔌 Supported Providers

Support is implemented through adapters.

Currently:

* MinIO (via `mine-adapter-minio`)

Planned:

* AWS S3
* Azure Blob Storage
* Other S3-compatible providers

---

## 🎯 Design Goals

* Provider abstraction
* Strong typing
* Clean separation of concerns
* Explicit error translation
* Minimal infrastructure leakage
* Multi-provider readiness
* Extensibility without tight coupling

---

## 🧱 Project Ecosystem

MINE is composed of multiple repositories:

* `mine-spec` → Domain contracts (MIT)
* `mine-adapter-minio` → MinIO adapter (AGPL-3.0-only)
* `mine` → Backend service (this repository)
* Frontend dashboard (in progress)

---

## 🚀 Getting Started

```bash
git clone https://github.com/elsonjunio/mine-storage-console.git
cd mine-storage-console
poetry install
poetry run uvicorn mine_backend.main:app --reload
```

---

## 🤖 MCP Server

MINE exposes a [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that allows AI assistants and automation tools to manage storage resources programmatically.

### Endpoint

The MCP server is mounted at:

```
http://localhost:8000/mcp
```

It uses the **Streamable HTTP** transport (stateful sessions over HTTP).

### Authentication

Every MCP tool accepts a `token` parameter — an internal session token issued by the MINE backend after a successful login.

Obtain a token by calling the `/auth/login` REST endpoint first, then pass the returned token to any MCP tool call.

Tools that operate on admin-only resources (users, groups, policies, quotas, credentials, notifications) will return a `PermissionDeniedError` if the token does not carry the admin role.

### Available Tools

#### Buckets

| Tool | Description |
|------|-------------|
| `list_buckets` | List all buckets visible to the authenticated user |
| `create_bucket` | Create a new bucket |
| `delete_bucket` | Delete an empty bucket |
| `get_bucket_versioning` | Get versioning status of a bucket |
| `set_bucket_versioning` | Enable or suspend versioning on a bucket |
| `get_bucket_quota` | Get the storage quota for a bucket *(admin)* |
| `set_bucket_quota` | Set a storage quota on a bucket *(admin)* |
| `get_bucket_usage` | Get current object count and size for a bucket |
| `get_bucket_policy` | Retrieve the S3 bucket policy document |
| `put_bucket_policy` | Apply an S3 bucket policy, replacing any existing one |
| `delete_bucket_policy` | Remove the bucket policy |
| `validate_bucket_policy` | Validate a policy document without applying it |
| `get_bucket_lifecycle` | Retrieve the lifecycle configuration |
| `put_bucket_lifecycle` | Apply a lifecycle configuration |
| `delete_bucket_lifecycle` | Remove the lifecycle configuration |
| `validate_bucket_lifecycle` | Validate a lifecycle config without applying it |
| `get_bucket_events` | Retrieve the event notification configuration |
| `put_bucket_events` | Apply an event notification configuration |
| `delete_bucket_events` | Remove all event notification configurations |

#### Objects

| Tool | Description |
|------|-------------|
| `list_objects` | List objects in a bucket, with optional prefix filter and pagination |
| `delete_object` | Delete an object |
| `copy_object` | Copy an object to a new location |
| `move_object` | Move an object (copy + delete source) |
| `generate_upload_url` | Generate a presigned PUT URL for direct upload |
| `generate_download_url` | Generate a presigned GET URL for direct download |
| `list_object_versions` | List all versions of an object |
| `delete_object_version` | Permanently delete a specific object version |
| `restore_object_version` | Restore a previous version as the latest |
| `get_object_metadata` | Retrieve object metadata without downloading content |
| `update_object_metadata` | Replace all custom metadata on an object |
| `get_object_tags` | Retrieve object tags |
| `update_object_tags` | Replace all tags on an object |

#### Policies *(admin)*

| Tool | Description |
|------|-------------|
| `list_policies` | List all storage policies |
| `get_policy` | Get a policy by name |
| `get_policy_groups` | List all groups that have a policy attached |
| `create_policy` | Create a new policy with an IAM document |
| `delete_policy` | Delete a policy by name |
| `attach_policy` | Attach a policy to a user |
| `detach_policy` | Detach a policy from a user |

#### Users *(admin)*

| Tool | Description |
|------|-------------|
| `list_users` | List all storage users |
| `get_user` | Get details for a specific user |
| `create_user` | Create a new storage user |
| `delete_user` | Delete a storage user |
| `enable_user` | Enable a disabled user |
| `disable_user` | Disable a user, revoking storage access |

#### Groups *(admin)*

| Tool | Description |
|------|-------------|
| `list_groups` | List all storage groups |
| `get_group` | Get group details including members and policies |
| `create_group` | Create a new group |
| `delete_group` | Delete a group |
| `add_users_to_group` | Add users to a group |
| `remove_users_from_group` | Remove users from a group |
| `enable_group` | Enable a disabled group |
| `disable_group` | Disable a group, suspending policy inheritance |
| `attach_policy_to_group` | Attach a policy to a group |
| `detach_policy_from_group` | Detach a policy from a group |
| `get_group_policies` | List all policies attached to a group |

#### Quotas *(admin)*

| Tool | Description |
|------|-------------|
| `get_quotas_overview` | Get usage and quota overview across all buckets |
| `set_global_quota` | Apply the same quota to every bucket |
| `remove_bucket_quota` | Remove the quota from a specific bucket |

#### Credentials *(admin)*

| Tool | Description |
|------|-------------|
| `list_credentials` | List service account credentials for a user |
| `create_credential` | Create a scoped service account credential |
| `delete_credential` | Delete a credential by access key |

#### Admin Notifications *(admin)*

| Tool | Description |
|------|-------------|
| `list_admin_notification_targets` | List notification targets by type |
| `create_admin_notification_target` | Create a new notification target |
| `delete_admin_notification_target` | Delete a notification target |

---

### Testing with MCP Inspector

[`@modelcontextprotocol/inspector`](https://github.com/modelcontextprotocol/inspector) is an interactive browser-based tool for exploring and calling MCP tools manually.

**Prerequisites:** Node.js 18+ installed.

#### 1. Start the backend

```bash
poetry run uvicorn mine_backend.main:app --reload
```

#### 2. Launch the inspector

```bash
npx @modelcontextprotocol/inspector
```

This opens the inspector UI at `http://localhost:5173` (or the port shown in the terminal).

#### 3. Connect to MINE

In the inspector:

1. Set **Transport** to `Streamable HTTP`
2. Set **URL** to `http://localhost:8000/mcp`
3. Click **Connect**

The inspector will discover all available tools automatically.

#### 4. Obtain a session token

Before calling any tool, you need a valid token. Call the `/auth/login` REST endpoint to get one:

```bash
curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "your-user", "password": "your-password"}' \
  | jq '.data.token'
```

Copy the returned token string.

#### 5. Call a tool

In the inspector, select any tool (e.g. `list_buckets`), fill in the `token` field with the value obtained above, and click **Run Tool**.

> **Tip:** Admin-only tools (marked *(admin)* in the tables above) require a token issued for a user that holds the `consoleAdmin` role. Calling them with a regular user token will return a `PermissionDeniedError`.

---

## 🛡 License

This project is licensed under the MIT License.

See the `LICENSE` file for details.

---

## ⚖️ Independence Notice

MINE is an independent project and is not affiliated with, endorsed by, or sponsored by any storage vendor.

Any third-party names mentioned are trademarks of their respective owners.
