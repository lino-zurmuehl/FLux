"""Tests for the encryption service."""

import pytest

from backend.services.encryption import EncryptionService


class TestEncryptionService:
    def test_generate_salt_unique(self):
        salt1 = EncryptionService.generate_salt()
        salt2 = EncryptionService.generate_salt()

        assert salt1 != salt2
        assert len(salt1) == 16

    def test_derive_key_deterministic(self):
        salt = EncryptionService.generate_salt()
        key1 = EncryptionService.derive_key("password123", salt)
        key2 = EncryptionService.derive_key("password123", salt)

        assert key1 == key2

    def test_derive_key_different_passwords(self):
        salt = EncryptionService.generate_salt()
        key1 = EncryptionService.derive_key("password1", salt)
        key2 = EncryptionService.derive_key("password2", salt)

        assert key1 != key2

    def test_encrypt_decrypt_roundtrip(self):
        salt = EncryptionService.generate_salt()
        key = EncryptionService.derive_key("test_password", salt)
        original_data = b'{"start_date": "2024-01-15", "flow": 3}'

        encrypted = EncryptionService.encrypt(original_data, key)
        decrypted = EncryptionService.decrypt(encrypted, key)

        assert decrypted == original_data

    def test_decrypt_wrong_key_fails(self):
        salt = EncryptionService.generate_salt()
        key1 = EncryptionService.derive_key("correct_password", salt)
        key2 = EncryptionService.derive_key("wrong_password", salt)

        encrypted = EncryptionService.encrypt(b"secret data", key1)

        with pytest.raises(Exception):
            EncryptionService.decrypt(encrypted, key2)
