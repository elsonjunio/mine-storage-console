import pytest
from unittest.mock import patch, MagicMock
from jose import jwt, JWTError

from mine_backend.services.session_service import issue_internal_token, decode_internal_token

_MOCK_SETTINGS = MagicMock()
_MOCK_SETTINGS.INTERNAL_TOKEN_SECRET = 'test-session-secret'
_MOCK_SETTINGS.INTERNAL_TOKEN_EXP_MINUTES = 60
_MOCK_SETTINGS.OPENID_ROLE_CLAIM = 'realm_access.roles'


@pytest.fixture(autouse=True)
def patch_settings():
    with patch('mine_backend.services.session_service.settings', _MOCK_SETTINGS):
        yield


class TestIssueInternalToken:
    def test_token_is_decodable(self):
        user_payload = {
            'sub': 'user-123',
            'preferred_username': 'testuser',
            'realm_access': {'roles': ['admin']},
        }
        sts_data = {'access_key': 'AK', 'secret_key': 'SK'}

        token = issue_internal_token(user_payload, sts_data)
        decoded = jwt.decode(token, 'test-session-secret', algorithms=['HS256'])

        assert decoded['sub'] == 'user-123'

    def test_token_contains_required_fields(self):
        user_payload = {
            'sub': 'user-123',
            'preferred_username': 'testuser',
            'realm_access': {'roles': ['admin']},
        }
        sts_data = {'access_key': 'AK', 'secret_key': 'SK'}

        token = issue_internal_token(user_payload, sts_data)
        decoded = jwt.decode(token, 'test-session-secret', algorithms=['HS256'])

        assert decoded['sub'] == 'user-123'
        assert decoded['username'] == 'testuser'
        assert decoded['type'] == 'mine_session'
        assert decoded['sts'] == sts_data
        assert 'exp' in decoded

    def test_token_contains_roles(self):
        user_payload = {
            'sub': 'user-456',
            'preferred_username': 'alice',
            'realm_access': {'roles': ['user', 'admin']},
        }
        sts_data = {}

        token = issue_internal_token(user_payload, sts_data)
        decoded = jwt.decode(token, 'test-session-secret', algorithms=['HS256'])

        assert 'roles' in decoded

    def test_token_has_correct_sub(self):
        user_payload = {
            'sub': 'specific-sub-value',
            'preferred_username': 'bob',
            'realm_access': {'roles': []},
        }
        token = issue_internal_token(user_payload, {})
        decoded = jwt.decode(token, 'test-session-secret', algorithms=['HS256'])
        assert decoded['sub'] == 'specific-sub-value'


class TestDecodeInternalToken:
    def test_roundtrip(self):
        user_payload = {
            'sub': 'user-123',
            'preferred_username': 'testuser',
            'realm_access': {'roles': []},
        }
        sts_data = {'access_key': 'AK', 'secret_key': 'SK'}

        token = issue_internal_token(user_payload, sts_data)
        decoded = decode_internal_token(token)

        assert decoded['sub'] == 'user-123'
        assert decoded['username'] == 'testuser'

    def test_invalid_token_raises_jwt_error(self):
        with pytest.raises(JWTError):
            decode_internal_token('not-a-valid-token')

    def test_wrong_secret_raises_jwt_error(self):
        payload = {'sub': 'user'}
        wrong_token = jwt.encode(payload, 'wrong-secret', algorithm='HS256')
        with pytest.raises(JWTError):
            decode_internal_token(wrong_token)
