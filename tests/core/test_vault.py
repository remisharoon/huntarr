from huntarr_core.vault import decrypt_secret, encrypt_secret


def test_vault_roundtrip() -> None:
    salt, nonce, ciphertext = encrypt_secret('secret-passphrase', {'password': 'hello123'})
    payload = decrypt_secret('secret-passphrase', salt, nonce, ciphertext)
    assert payload['password'] == 'hello123'
