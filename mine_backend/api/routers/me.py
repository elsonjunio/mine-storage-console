from fastapi import APIRouter, Depends
from mine_backend.api.dependencies.auth import get_current_user

router = APIRouter()


@router.get('/me')
async def me(user: dict = Depends(get_current_user)):
    return {
        'user_id': user.get('sub'),
        'username': user.get('preferred_username'),
        'email': user.get('email'),
        'roles': user.get('realm_access', {}).get('roles', []),
        'client_roles': user.get('resource_access', {}),
        'raw_claims': user,
    }
