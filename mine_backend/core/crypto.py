import os
import base64
import json
import hashlib
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from mine_backend.config import settings


def _derive_key(token: str) -> bytes:
    """
    Deriva chave de 256 bits usando:
    master_key + token
    """
    raw = (settings.INTERNAL_TOKEN_SECRET + token).encode()
    return hashlib.sha256(raw).digest()


def encrypt_payload(payload: dict, token: str) -> str:
    key = _derive_key(token)

    aesgcm = AESGCM(key)
    nonce = os.urandom(12)

    data = json.dumps(payload).encode()

    encrypted = aesgcm.encrypt(nonce, data, None)

    final = nonce + encrypted

    return base64.b64encode(final).decode()


def decrypt_payload(encrypted_b64: str, token: str) -> dict:
    key = _derive_key(token)

    raw = base64.b64decode(encrypted_b64)

    nonce = raw[:12]
    ciphertext = raw[12:]

    aesgcm = AESGCM(key)

    decrypted = aesgcm.decrypt(nonce, ciphertext, None)

    return json.loads(decrypted.decode())
