from fastapi import APIRouter, Depends
from mine_backend.api.dependencies.authorization import require_role

router = APIRouter()


@router.get("/admin-only")
async def admin_route(user=Depends(require_role("consoleAdmin"))):
    return {"message": "You are admin", "user": user}