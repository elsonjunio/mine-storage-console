import pytest
from unittest.mock import patch, MagicMock

from mine_backend.core.crypto import encrypt_payload, decrypt_payload

_MOCK_SETTINGS = MagicMock()
_MOCK_SETTINGS.INTERNAL_TOKEN_SECRET = 'test-secret'


@pytest.fixture(autouse=True)
def patch_settings():
    with patch('mine_backend.core.crypto.settings', _MOCK_SETTINGS):
        yield


class TestCrypto:
    def test_roundtrip(self):
        payload = {'key': 'value'}
        token = 'my-token'
        encrypted = encrypt_payload(payload, token)
        decrypted = decrypt_payload(encrypted, token)
        assert decrypted == payload

    def test_different_tokens_produce_different_ciphertexts(self):
        payload = {'key': 'value'}
        enc1 = encrypt_payload(payload, 'token-1')
        enc2 = encrypt_payload(payload, 'token-2')
        assert enc1 != enc2

    def test_wrong_token_raises_on_decrypt(self):
        payload = {'key': 'value'}
        encrypted = encrypt_payload(payload, 'correct-token')
        with pytest.raises(Exception):
            decrypt_payload(encrypted, 'wrong-token')

    def test_nested_payload_roundtrip(self):
        payload = {
            'user': {'name': 'Alice', 'roles': ['admin', 'user']},
            'exp': 9999,
        }
        token = 'nested-token'
        encrypted = encrypt_payload(payload, token)
        decrypted = decrypt_payload(encrypted, token)
        assert decrypted == payload

    def test_same_payload_different_nonces(self):
        """Each encryption produces a different ciphertext due to random nonce."""
        payload = {'key': 'value'}
        token = 'token'
        enc1 = encrypt_payload(payload, token)
        enc2 = encrypt_payload(payload, token)
        assert enc1 != enc2
