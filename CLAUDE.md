# CLAUDE.md — Project Instructions for Claude Code

## Project Overview

**MINE** (MINE Is Not Enterprise) is a lightweight, clean storage management platform. It provides a REST API backend (Python/FastAPI) for managing S3-compatible object storage, with an Angular frontend dashboard in development.

---

## Repository Structure

```
mine_backend/       # Python FastAPI backend (production-ready)
mine_ui/            # Angular 21 frontend (in development)
tests/              # pytest test suite for the backend
pyproject.toml      # Poetry configuration and backend dependencies
```

---

## Development Commands

### Backend (Python/Poetry)

```bash
# Install dependencies
poetry install

# Start dev server with hot reload (port 8000)
poetry run uvicorn mine_backend.main:app --reload

# Run all tests
pytest tests -v

# Format code (Blue formatter — Black-compatible)
blue mine_backend/
```

### Frontend (Angular/npm)

```bash
cd mine_ui

# Install dependencies
npm install

# Start dev server (port 4200)
npm run start

# Build for production
npm run build

# Run unit tests (Vitest)
npm test
```

---

## Architecture

MINE follows **Clean Architecture** with strict layer separation:

1. **Domain layer** — `mine-spec` (external git dependency): abstract ports/contracts
2. **Application layer** — `mine_backend/services/`: business logic, no infrastructure details
3. **Interface layer** — `mine_backend/api/`: FastAPI routers, Pydantic schemas, DI
4. **Infrastructure** — `mine_backend/core/`: Keycloak, JWT, crypto; adapters loaded dynamically

**Key rule:** Services depend only on abstract ports (`ObjectStoragePort`, `UserAdminPort`). Never import infrastructure directly into services.

---

## Code Conventions

### Python (backend)

- **Formatter:** `blue` (Black-compatible) — run before committing
- **Python version:** 3.11+
- **Type hints:** required everywhere
- **Async:** use `async`/`await` throughout; services and routes are async
- **Error handling:** raise domain exceptions from `mine_backend/exceptions/`, never return raw HTTP errors from services
- **Response shape:** always wrap in `StandardResponse` from `api/schemas/response.py`
- **Dependency injection:** use FastAPI `Depends()` for injecting services and auth

### TypeScript (frontend)

- **Strict mode:** enabled in `tsconfig.json` — no implicit `any`
- **Standalone components:** all Angular components use standalone API (no NgModules)
- **Styling:** Tailwind CSS utility classes + SCSS per-component
- **i18n:** use `@ngx-translate` for all user-facing strings, never hardcode UI text
- **Reactivity:** RxJS observables for async operations

---

## Environment Variables

Backend requires a `.env` file at the project root:

```
S3_REGION=us-east-1
S3_ENDPOINT=<minio-host>:<port>
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_SECURE=false

KEYCLOAK_URL=https://<keycloak-host>/
KEYCLOAK_REALM=<realm>
KEYCLOAK_CLIENT_ID=<client-id>
KEYCLOAK_CLIENT_SECRET=...

OPENID_ROLE_CLAIM=policy
ADMIN_ROLE=consoleAdmin

INTERNAL_TOKEN_SECRET=<change-this>
INTERNAL_TOKEN_EXP_MINUTES=30

ADMIN_PATH=mine_adapter_minio.factory
S3_CLIENT_PATH=mine_adapter_minio.factory
```

`ADMIN_PATH` and `S3_CLIENT_PATH` use Python module paths for dynamic adapter loading via `importlib`.

---

## Testing

- Tests live in `tests/` and mirror the service layer
- Run with `pytest tests -v`
- `asyncio_mode = "auto"` is configured — no need to mark async tests manually
- Use `conftest.py` fixtures: `mock_s3` and `mock_admin` for mocking providers
- Do not add integration tests that require live MinIO or Keycloak

---

## Key Files

| Path | Purpose |
|------|---------|
| `mine_backend/main.py` | App factory, lifespan, exception handler wiring |
| `mine_backend/config.py` | Settings (pydantic-settings), dynamic provider loading |
| `mine_backend/api/router.py` | Aggregates all API routers |
| `mine_backend/core/security.py` | Token verification (Keycloak + internal JWT) |
| `mine_backend/core/keycloak.py` | JWKS fetching and caching |
| `mine_backend/exceptions/application.py` | All domain exceptions |
| `mine_backend/api/exception_handlers.py` | Maps exceptions to HTTP responses |
| `mine_backend/api/schemas/response.py` | `StandardResponse` wrapper |

---

## Important Constraints

- **No database** — state lives entirely in object storage and Keycloak
- **No direct S3/MinIO imports in services** — always go through the abstract port
- Credentials in `.env` are for local dev only — never commit secrets
- The frontend is a work in progress; focus backend changes on stability
