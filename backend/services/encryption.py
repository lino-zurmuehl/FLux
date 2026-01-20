"""Encryption service for protecting sensitive health data.

Privacy approach:
- All cycle data is encrypted at rest using user-derived keys
- Keys are derived from user password, never stored on server
- Server only sees encrypted blobs, cannot read user data
"""

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64
import os


class EncryptionService:
    """Handle encryption/decryption of sensitive cycle data."""

    @staticmethod
    def derive_key(password: str, salt: bytes) -> bytes:
        """Derive encryption key from user password."""
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=480000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(password.encode()))
        return key

    @staticmethod
    def generate_salt() -> bytes:
        """Generate a random salt for key derivation."""
        return os.urandom(16)

    @staticmethod
    def encrypt(data: bytes, key: bytes) -> bytes:
        """Encrypt data using the provided key."""
        f = Fernet(key)
        return f.encrypt(data)

    @staticmethod
    def decrypt(encrypted_data: bytes, key: bytes) -> bytes:
        """Decrypt data using the provided key."""
        f = Fernet(key)
        return f.decrypt(encrypted_data)
