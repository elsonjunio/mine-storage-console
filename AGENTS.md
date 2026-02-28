# AGENTS.md — Project Guide for AI Agents

## What Is This Project?

**MINE** (MINE Is Not Enterprise) is a lightweight storage management platform providing a REST API for S3-compatible object storage (primarily MinIO). It is intentionally non-enterprise, MIT-licensed, and built on Clean Architecture principles.

**Status:** Backend is production-ready. Angular frontend dashboard is in active development.

---

## Repository Layout

```
mine_backend/                   # Python 3.11+ FastAPI backend
│   api/
│   │   routers/                # HTTP endpoint handlers (11 routers)
│   │   schemas/                # Pydantic request/response models
│   │   dependencies/           # FastAPI DI: auth, authz
│   │   exception_handlers.py   # Maps domain exceptions → HTTP responses
│   │   router.py               # Aggregates all routers
│   services/                   # Business logic (11 service classes)
│   core/
│   │   security.py             # Token verification (Keycloak + internal JWT)
│   │   keycloak.py             # JWKS fetching/caching
│   │   authorization.py        # RBAC logic
│   │   crypto.py               # AESGCM encryption
│   │   logging_config.py       # JSON structured logging
│   exceptions/
│   │   base.py                 # AppException base class
│   │   application.py          # Domain exceptions (NotFoundError, etc.)
│   config.py                   # pydantic-settings + dynamic adapter loading
│   main.py                     # App entry point

mine_ui/                        # Angular 21 frontend (in development)
│   src/app/
│   │   features/               # Feature modules (demo placeholder)
│   │   shared/components/      # Reusable UI components (button, table, etc.)
│   │   core/theme/             # Theme service (light/dark/system)
│   │   app.routes.ts           # Route definitions
│   angular.json
│   package.json

tests/                          # pytest unit tests for backend
│   conftest.py                 # Shared fixtures (mock_s3, mock_admin)
│   test_*.py                   # 11 test files, one per service/module

pyproject.toml                  # Poetry config, Python dependencies
```

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Backend language | Python 3.11+ |
| Backend framework | FastAPI 0.129 + Uvicorn |
| Auth | Keycloak (OpenID Connect / JWKS), python-jose for JWT |
| Storage client | boto3 (S3-compatible) |
| Config | pydantic-settings + python-dotenv |
| HTTP client | httpx (async) |
| Encryption | cryptography (AESGCM) |
| Backend tests | pytest + pytest-asyncio |
| Code formatter | blue (Black-compatible) |
| Frontend language | TypeScript 5.9 (strict) |
| Frontend framework | Angular 21 (standalone components) |
| Frontend styling | Tailwind CSS 4 + SCSS |
| i18n | @ngx-translate |
| Frontend tests | Vitest + jsdom |
| Package managers | Poetry (backend), npm (frontend) |

---

## Architecture

MINE uses **Clean Architecture** with four layers:

```
┌─────────────────────────────────────────────┐
│  Interface Layer  (api/routers, api/schemas) │
├─────────────────────────────────────────────┤
│  Application Layer  (services/)             │
├─────────────────────────────────────────────┤
│  Domain Layer  (mine-spec, external)        │
├─────────────────────────────────────────────┤
│  Infrastructure  (core/, adapters via config)│
└─────────────────────────────────────────────┘
```

- Services depend on **abstract ports** (`ObjectStoragePort`, `UserAdminPort`) from `mine-spec`
- Adapters are **loaded dynamically** at startup via `importlib` using `ADMIN_PATH` and `S3_CLIENT_PATH` env vars
- Current default adapter: `mine_adapter_minio`

### Authentication Flow

1. Client presents Keycloak JWT (RS256, verified against JWKS)
2. Backend exchanges it for STS credentials (AssumeRoleWithWebIdentity)
3. Backend issues an internal session token (HS256) containing STS creds
4. All subsequent requests use the internal token

### Error Handling Pattern

```
Service raises AppException subclass
    → exception_handlers.py maps it to HTTP status + JSON body
    → Response always uses StandardResponse shape: {success, data, error}
```

---

## Running the Project

### Backend

```bash
# Install dependencies
poetry install

# Start development server (http://localhost:8000)
poetry run uvicorn mine_backend.main:app --reload

# Run tests
pytest tests -v
```

### Frontend

```bash
cd mine_ui
npm install
npm run start    # http://localhost:4200
npm test         # Vitest unit tests
npm run build    # Production build → dist/
```

---

## Environment Configuration

Create `.env` in the project root for the backend:

```env
# S3-compatible storage
S3_REGION=us-east-1
S3_ENDPOINT=<host>:<port>
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_SECURE=false

# Keycloak OpenID Connect
KEYCLOAK_URL=https://<host>/
KEYCLOAK_REALM=<realm>
KEYCLOAK_CLIENT_ID=<client>
KEYCLOAK_CLIENT_SECRET=...

# Role/RBAC
OPENID_ROLE_CLAIM=policy      # JWT claim containing user roles
ADMIN_ROLE=consoleAdmin

# Internal session tokens
INTERNAL_TOKEN_SECRET=<change-this>
INTERNAL_TOKEN_EXP_MINUTES=30

# Adapter module paths (dynamic loading)
ADMIN_PATH=mine_adapter_minio.factory
S3_CLIENT_PATH=mine_adapter_minio.factory
```

---

## Service Layer Reference

| Service | File | Responsibilities |
|---------|------|-----------------|
| BucketService | `services/bucket_service.py` | Create/delete/list buckets, versioning, quota, lifecycle, events, policy |
| ObjectService | `services/object_service.py` | List/copy/delete objects, ACLs, retention, legal hold |
| AuthService | `services/auth_service.py` | Keycloak token → STS → internal session token |
| UserService | `services/user_service.py` | Admin: list/create/delete/disable users |
| GroupService | `services/group_service.py` | Admin: group management |
| CredentialService | `services/credential_service.py` | CRUD access credentials |
| PolicyService | `services/policy_service.py` | IAM policy operations |
| STSService | `services/sts_service.py` | AssumeRoleWithWebIdentity |
| SessionService | `services/session_service.py` | Internal JWT issuance and validation |
| AdminNotificationService | `services/admin_notification_service.py` | Admin notification system |
| AuthorizationService | `services/authorization_service.py` | Role requirement validation |

---

## API Routers

All routers are mounted under the `/api` prefix via `api/router.py`.

| Router file | Endpoints |
|-------------|-----------|
| `auth.py` | `POST /auth` — token exchange |
| `buckets.py` | CRUD, versioning, quota, policy, lifecycle, events |
| `objects.py` | List, copy, delete, ACL, retention, legal hold |
| `credentials.py` | CRUD access credentials |
| `user.py` | Admin user management |
| `groups.py` | Admin group management |
| `policies.py` | IAM policy management |
| `me.py` | Current user info |
| `admin.py` | Admin-only operations |
| `admin_notifications.py` | Admin notifications |

---

## Domain Exceptions

Defined in `mine_backend/exceptions/application.py`:

- `NotFoundError` → HTTP 404
- `PermissionDeniedError` → HTTP 403
- `ConflictError` → HTTP 409
- `UnauthorizedError` → HTTP 401
- `ValidationError` → HTTP 422
- `ServiceUnavailableError` → HTTP 503
- `InternalError` → HTTP 500

Always raise these from service layer; never catch and re-raise as generic exceptions.

---

## Testing Guidelines

- All tests live in `tests/` and use `pytest` with `asyncio_mode = "auto"`
- Use `mock_s3` and `mock_admin` fixtures from `conftest.py` to mock providers
- Tests target the **service layer** — do not test routers directly
- Do not write tests that require a live MinIO instance or Keycloak server
- New services must have a corresponding `test_<service_name>.py`

---

## Frontend Component Library

Reusable UI components are in `mine_ui/src/app/shared/components/`:

`ui-button`, `ui-input-text`, `ui-select`, `ui-checkbox`, `ui-toggle`, `ui-badge`, `ui-progress-bar`, `ui-card`, `ui-table`, `ui-state-card`

- All are standalone Angular components
- Styled with Tailwind CSS
- Support light/dark themes via `ThemeService` (`core/theme/theme.service.ts`)
- Use `@ngx-translate` for any labels/text

---

## Key Constraints

- **No database** — all persistent state is in object storage or Keycloak
- **No S3/MinIO imports in services** — use abstract ports from `mine-spec` only
- **No hardcoded credentials** — everything through env vars / `.env`
- **No enterprise features** — keep it simple and lightweight by design
- Python **type hints are mandatory** on all functions
- TypeScript **strict mode is on** — no implicit `any`
