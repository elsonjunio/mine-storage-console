import json
import pytest
from unittest.mock import AsyncMock
from fastapi import Request

from mine_backend.api.exception_handlers import (
    app_exception_handler,
    unhandled_exception_handler,
)
from mine_backend.exceptions.base import AppException
from mine_backend.exceptions.application import (
    InvalidTokenError,
    PermissionDeniedError,
    InconsistentDataError,
    UnexpectedError,
    ServiceUnavailableError,
)


@pytest.fixture
def mock_request():
    return AsyncMock(spec=Request)


async def test_invalid_token_maps_to_401(mock_request):
    exc = InvalidTokenError('bad token')
    response = await app_exception_handler(mock_request, exc)
    assert response.status_code == 401


async def test_sts_credentials_not_found_maps_to_401(mock_request):
    exc = AppException('no sts', 'STS_CREDENTIALS_NOT_FOUND')
    response = await app_exception_handler(mock_request, exc)
    assert response.status_code == 401


async def test_permission_denied_maps_to_403(mock_request):
    exc = PermissionDeniedError('not allowed')
    response = await app_exception_handler(mock_request, exc)
    assert response.status_code == 403


async def test_bucket_not_found_maps_to_404(mock_request):
    exc = AppException('bucket missing', 'BUCKET_NOT_FOUND')
    response = await app_exception_handler(mock_request, exc)
    assert response.status_code == 404


async def test_bucket_already_exists_maps_to_409(mock_request):
    exc = AppException('bucket exists', 'BUCKET_ALREADY_EXISTS')
    response = await app_exception_handler(mock_request, exc)
    assert response.status_code == 409


async def test_inconsistent_data_maps_to_400(mock_request):
    exc = InconsistentDataError('bad data')
    response = await app_exception_handler(mock_request, exc)
    assert response.status_code == 400


async def test_unexpected_error_maps_to_500(mock_request):
    exc = UnexpectedError('internal error')
    response = await app_exception_handler(mock_request, exc)
    assert response.status_code == 500


async def test_unavailable_error_maps_to_503(mock_request):
    exc = ServiceUnavailableError('service down')
    response = await app_exception_handler(mock_request, exc)
    assert response.status_code == 503


async def test_unknown_code_falls_back_to_400(mock_request):
    exc = AppException('custom error', 'UNKNOWN_CODE_XYZ')
    response = await app_exception_handler(mock_request, exc)
    assert response.status_code == 400


async def test_response_content_has_success_false(mock_request):
    exc = InvalidTokenError('bad')
    response = await app_exception_handler(mock_request, exc)
    content = json.loads(response.body)
    assert content['success'] is False


async def test_response_content_has_code_and_message(mock_request):
    exc = InvalidTokenError('custom msg')
    response = await app_exception_handler(mock_request, exc)
    content = json.loads(response.body)
    assert content['error']['code'] == 'INVALID_TOKEN'
    assert content['error']['message'] == 'custom msg'


async def test_unhandled_exception_handler_returns_500(mock_request):
    exc = RuntimeError('something broke')
    response = await unhandled_exception_handler(mock_request, exc)
    assert response.status_code == 500


async def test_unhandled_exception_handler_includes_error_message(mock_request):
    exc = RuntimeError('something broke')
    response = await unhandled_exception_handler(mock_request, exc)
    content = json.loads(response.body)
    assert content['success'] is False
    assert 'something broke' in content['error']['message']


async def test_unhandled_exception_handler_success_false(mock_request):
    exc = ValueError('bad value')
    response = await unhandled_exception_handler(mock_request, exc)
    content = json.loads(response.body)
    assert content['success'] is False
