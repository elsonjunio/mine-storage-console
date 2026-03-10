

# MINE

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
* 🚧 Frontend (in development)

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

*(Example placeholder — adjust to your stack)*

```bash
git clone https://github.com/elsonjunio/mine-storage-console.git
cd mine-storage-console
poetry install
poetry run uvicorn mine_backend.main:app --reload
```

---

## 🛡 License

This project is licensed under the MIT License.

See the `LICENSE` file for details.

---

## ⚖️ Independence Notice

MINE is an independent project and is not affiliated with, endorsed by, or sponsored by any storage vendor.

Any third-party names mentioned are trademarks of their respective owners.

---

## 🔭 Roadmap

* [x] Backend core architecture
* [x] Provider abstraction layer
* [x] MinIO adapter
* [ ] Frontend dashboard
* [ ] Multi-provider support
* [ ] Capability discovery UI
* [ ] Observability layer

---
tools:
 - npx @modelcontextprotocol/inspector
 - npx @modelcontextprotocol/inspector http://localhost:8000/mcp