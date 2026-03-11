# MEMORY.md — Project Logbook

This file serves as a running log of decisions made, tasks completed, and context to carry forward across sessions. Update it whenever a meaningful decision is made or a significant task is completed.

---

## Current Branch
`upload_implementation`

---

## Active Work (Uncommitted Changes)

As of 2026-03-10, the following areas have active modifications:

### Backend
- `mine_backend/api/router.py` — router aggregation updates
- `mine_backend/api/routers/policies.py` — policy endpoints
- `mine_backend/api/schemas/policies.py` — policy schemas
- `mine_backend/api/routers/quotas.py` *(new)* — quota endpoints
- `mine_backend/api/schemas/quotas.py` *(new)* — quota schemas
- `mine_backend/services/bucket_service.py` — bucket service updates
- `mine_backend/services/policy_service.py` — policy service updates
- `mine_backend/main.py` — app wiring
- `mine_backend/mcp/` *(new)* — MCP server with bucket tools

### Frontend
- `mine_ui/src/app/features/policies/` *(new)* — policies feature
- `mine_ui/src/app/features/quotas/` *(new)* — quotas feature
- `mine_ui/src/app/features/notifications/` *(new)* — notifications feature
- `mine_ui/src/app/core/toast/` *(new)* — toast notification service
- `mine_ui/src/app/shared/components/toast/` *(new)* — toast UI component
- Sidebar, bucket-detail, buckets, users, groups — various updates
- i18n files (en, es, pt-BR) updated

---

## Completed Features (by commit)

| Date (approx) | Commit | Description |
|---|---|---|
| — | `2601d72` | Groups and users frontend feature |
| — | `c5d061b` | Auth callback UI enhancements; bucket detail input styling |
| — | `d604305` | Bucket feature complete |
| — | `d0d2c44` | Bucket feature enhancements |
| — | `f68d911` | Upload functionality |
| — | `be9cca1` | Code structure refactor |
| — | `a17edf2` | BFF auth flow + user menu with live data |
| — | `e44bb04` | Frontend work |
| — | `745229a` | Unit tests |
| — | `8ed2964` | Initial commit |

---

## Architecture Decisions

- **No database** — all state in MinIO (object storage) and Keycloak. This is intentional and must not change.
- **Clean Architecture** — services depend only on abstract ports from `mine-spec`. Never import MinIO/Keycloak SDKs directly in services.
- **BFF auth pattern** — Angular frontend delegates auth to backend (BFF), which handles Keycloak PKCE flow. Internal JWT is issued to the frontend after auth.
- **Dynamic adapter loading** — `ADMIN_PATH` and `S3_CLIENT_PATH` env vars point to Python module paths loaded via `importlib`. This keeps adapters pluggable.
- **Standalone Angular components** — no NgModules; all components use Angular 21 standalone API.
- **MCP server added** — `mine_backend/mcp/` exposes bucket tools via Model Context Protocol. This is an additive feature and does not affect the REST API.

---

## Conventions to Remember

- Always wrap API responses in `StandardResponse` from `mine_backend/api/schemas/response.py`
- Raise domain exceptions from `mine_backend/exceptions/application.py`; never return raw HTTP errors from services
- Use `blue` formatter on all Python changes before committing
- All Angular UI text must go through `@ngx-translate` — never hardcode strings; add keys to all three i18n files (en, es, pt-BR)
- Toast notifications in the frontend use the new `core/toast/` service

---

## Open Questions / TODOs

- Quotas feature: backend routers/schemas created but integration with bucket service TBD
- Policies feature: frontend feature added; verify full round-trip with backend policy service
- MCP server: extent of tools and deployment model not finalized
- `code.html` untracked file at project root — purpose unclear, may be temporary

---

## Notes for Next Session

- Check if quotas router is wired into `mine_backend/api/router.py`
- Verify i18n keys for new features (policies, quotas, notifications) are consistent across en/es/pt-BR
- The `upload_implementation` branch has many uncommitted changes — consider committing in logical chunks
