from fastapi import APIRouter, Depends
from typing import List
from mine_backend.services.group_service import GroupService
from mine_backend.api.dependencies.authorization import require_role

from mine_backend.api.schemas.response import StandardResponse
from mine_backend.api.schemas.group import (
    GroupResponse,
    GroupListResponse,
    GroupPolicyReponse,
    GroupPolicyMappReponse,
    CreateGroupRequest,
    GroupUsersRequest,
    DeleteGroupUsersRequest,
    GroupPolicyRequest,
    GroupPolicyDeatached,
    GroupPolicyAttached,

)
from mine_backend.api.utils.response import success_response

from mine_backend.config import get_admin, settings


router = APIRouter(prefix='/groups', tags=['admin-groups'])


def get_service():
    return GroupService(get_admin())


@router.get(
    '',
    response_model=StandardResponse[List[GroupListResponse]],
)
def list_groups(
    service: GroupService = Depends(get_service),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):
    group_list = service.list_groups()
    return success_response(group_list)


@router.get(
    '/{name}',
    response_model=StandardResponse[List[GroupResponse]],
)
def get_group(
    name: str,
    service: GroupService = Depends(get_service),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):

    group = service.get_group(name)
    return success_response(group)


@router.post(
    '',
    response_model=StandardResponse[List[GroupResponse]],
)
def create_group(
    payload: CreateGroupRequest,
    service: GroupService = Depends(get_service),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):
    group =  service.create_group(payload.name, payload.users)
    return success_response(group)

@router.delete(
    '/{name}',
    response_model=StandardResponse[List[GroupResponse]],
)
def delete_group(
    name: str,
    service: GroupService = Depends(get_service),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):

    group = service.delete_group(name)
    return success_response(group)


@router.post(
    '/users',
    response_model=StandardResponse[List[GroupResponse]],
)
def add_users(
    payload: GroupUsersRequest,
    service: GroupService = Depends(get_service),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):
    group = service.add_users(payload.name, payload.users)
    return success_response(group)


@router.delete(
    '/{name}/users',
    response_model=StandardResponse[List[GroupResponse]],
)
def remove_users(
    name: str,
    payload: DeleteGroupUsersRequest,
    service: GroupService = Depends(get_service),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):

    group = service.remove_users(name, payload.users)
    return success_response(group)


@router.post(
    '/enable/{name}',
    response_model=StandardResponse[List[GroupResponse]],
)
def enable_group(
    name: str,
    service: GroupService = Depends(get_service),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):
    group = service.enable_group(name)
    return success_response(group)


@router.post(
    '/disable/{name}',
    response_model=StandardResponse[List[GroupResponse]],
)
def disable_group(
    name: str,
    service: GroupService = Depends(get_service),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):
    group = service.disable_group(name)
    return success_response(group)


@router.post(
    '/attach-policy',
    response_model=StandardResponse[List[GroupPolicyAttached]],
)
def attach_policy(
    payload: GroupPolicyRequest,
    service: GroupService = Depends(get_service),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):
    group_policy = service.attach_policy(payload.group, payload.policy)
    return success_response(group_policy)


@router.post(
    '/detach-policy',
    response_model=StandardResponse[List[GroupPolicyDeatached]],
)
def detach_policy(
    payload: GroupPolicyRequest,
    service: GroupService = Depends(get_service),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):
    group_policy = service.detach_policy(payload.group, payload.policy)
    return success_response(group_policy)


@router.get(
    '/{name}/policies',
    response_model=StandardResponse[List[GroupPolicyMappReponse]],
)
def policies(
    name: str,
    service: GroupService = Depends(get_service),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):
    group_policy = service.get_attach_policy(name)
    return success_response(group_policy)
