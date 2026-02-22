from fastapi import APIRouter
from mine_backend.api.routers import me
from mine_backend.api.routers import admin
from mine_backend.api.routers import credentials
from mine_backend.api.routers import auth
from mine_backend.api.routers import buckets
from mine_backend.api.routers import objects
from mine_backend.api.routers import user
from mine_backend.api.routers import groups
from mine_backend.api.routers import policies
from mine_backend.api.routers import admin_notifications


api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(me.router)
api_router.include_router(admin.router)
api_router.include_router(user.router)
api_router.include_router(groups.router)
api_router.include_router(credentials.router)
api_router.include_router(policies.router)
api_router.include_router(buckets.router)
api_router.include_router(objects.router)
api_router.include_router(admin_notifications.router)