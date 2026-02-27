import pytest
from unittest.mock import patch, MagicMock, AsyncMock

from mine_backend.core.security import (
    verify_keycloak_token,
    verify_internal_session,
    extract_sts_credentials,
)
from mine_backend.exceptions.application import (
    InvalidTokenError,
    STSCredentialsNotFoundError,
)

_MOCK_SETTINGS = MagicMock()
_MOCK_SETTINGS.KEYCLOAK_CLIENT_ID = 'test-client'


async def test_verify_keycloak_token_success():
    payload = {'sub': 'user-123', 'preferred_username': 'testuser'}
    mock_jwt = MagicMock()
    mock_jwt.decode.return_value = payload

    with patch('mine_backend.core.security.get_jwks', new=AsyncMock(return_value={})), \
         patch('mine_backend.core.security.settings', _MOCK_SETTINGS), \
         patch('mine_backend.core.security.jwt', mock_jwt):
        result = await verify_keycloak_token('some-token')

    assert result == payload


async def test_verify_keycloak_token_raises_invalid_token_on_exception():
    mock_jwt = MagicMock()
    mock_jwt.decode.side_effect = Exception('bad token')

    with patch('mine_backend.core.security.get_jwks', new=AsyncMock(return_value={})), \
         patch('mine_backend.core.security.settings', _MOCK_SETTINGS), \
         patch('mine_backend.core.security.jwt', mock_jwt):
        with pytest.raises(InvalidTokenError):
            await verify_keycloak_token('bad-token')


def test_verify_internal_session_success():
    decoded = {'sub': 'user-123', 'type': 'mine_session'}

    with patch('mine_backend.core.security.decode_internal_token', return_value=decoded):
        result = verify_internal_session('valid-token')

    assert result == decoded


def test_verify_internal_session_raises_invalid_token_on_exception():
    with patch('mine_backend.core.security.decode_internal_token', side_effect=Exception('bad')):
        with pytest.raises(InvalidTokenError):
            verify_internal_session('bad-token')


def test_extract_sts_credentials_success():
    session = {
        'sts': {
            'access_key': 'AKID',
            'secret_key': 'SK',
            'session_token': 'ST',
        }
    }
    result = extract_sts_credentials(session)
    assert result['aws_access_key_id'] == 'AKID'
    assert result['aws_secret_access_key'] == 'SK'
    assert result['aws_session_token'] == 'ST'


def test_extract_sts_credentials_missing_sts():
    session = {'sub': 'user-123'}
    with pytest.raises(STSCredentialsNotFoundError):
        extract_sts_credentials(session)


def test_extract_sts_credentials_none_sts():
    session = {'sts': None}
    with pytest.raises(STSCredentialsNotFoundError):
        extract_sts_credentials(session)
