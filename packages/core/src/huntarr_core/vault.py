from __future__ import annotations

import json
import os

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC


def _derive_key(passphrase: str, salt: bytes) -> bytes:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=390_000,
    )
    return kdf.derive(passphrase.encode("utf-8"))


def encrypt_secret(passphrase: str, payload: dict[str, str]) -> tuple[bytes, bytes, bytes]:
    salt = os.urandom(16)
    nonce = os.urandom(12)
    key = _derive_key(passphrase, salt)
    cipher = AESGCM(key)
    ciphertext = cipher.encrypt(nonce, json.dumps(payload).encode("utf-8"), None)
    return salt, nonce, ciphertext


def decrypt_secret(passphrase: str, salt: bytes, nonce: bytes, ciphertext: bytes) -> dict[str, str]:
    key = _derive_key(passphrase, salt)
    cipher = AESGCM(key)
    plaintext = cipher.decrypt(nonce, ciphertext, None)
    return json.loads(plaintext.decode("utf-8"))
