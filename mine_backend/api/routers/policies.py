from fastapi import APIRouter, Depends
from mine_backend.services.policy_service import PolicyService
from mine_backend.api.dependencies.authorization import require_role
from mine_backend.api.utils.response import success_response
from mine_backend.api.schemas.response import StandardResponse
from mine_backend.api.schemas.policies import (
    PolicyResponse,
    PolicyAttachedResponse,
    PolicyDetachedResponse,
    CreatePolicyRequest,
    AttachPolicyRequest,
)
from typing import List
from mine_backend.config import get_admin, settings

router = APIRouter(prefix='/policies', tags=['admin-policies'])


def get_service():
    return PolicyService(get_admin())


@router.get(
    '',
    response_model=StandardResponse[List[PolicyResponse]],
)
def list_policies(
    service: PolicyService = Depends(get_service),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):
    policies = service.list_policies()
    return success_response(policies)


@router.get(
    '/{name}',
    response_model=StandardResponse[List[PolicyResponse]],
)
def get_policy(
    name: str,
    service: PolicyService = Depends(get_service),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):
    policy = service.get_policy(name)
    return success_response(policy)


@router.post(
    '',
    response_model=StandardResponse[List[PolicyResponse]],
)
def create_policy(
    payload: CreatePolicyRequest,
    service: PolicyService = Depends(get_service),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):
    policy = service.create_policy(payload.name, payload.document)
    return success_response(policy)


@router.delete(
    '/{name}',
    response_model=StandardResponse[List[PolicyResponse]],
)
def delete_policy(
    name: str,
    service: PolicyService = Depends(get_service),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):
    policy = service.delete_policy(name)
    return success_response(policy)


@router.post(
    '/attach',
    response_model=StandardResponse[List[PolicyAttachedResponse]],
)
def attach_policy(
    payload: AttachPolicyRequest,
    service: PolicyService = Depends(get_service),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):
    attached_policy = service.attach_policy(payload.policy, payload.username)
    return success_response(attached_policy)


@router.post(
    '/detach',
    response_model=StandardResponse[List[PolicyDetachedResponse]],
)
def detach_policy(
    payload: AttachPolicyRequest,
    service: PolicyService = Depends(get_service),
    user=Depends(require_role(f'{settings.ADMIN_ROLE}')),
):
    attached_policy = service.detach_policy(payload.policy, payload.username)
    return success_response(attached_policy)
