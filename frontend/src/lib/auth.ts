/**
 * Authentication for PIN-based app protection.
 *
 * The PIN is no longer stored as a hash: it derives the AES-GCM key that
 * encrypts all health data at rest (see lib/secureStore.ts). Verifying the
 * PIN IS the successful authenticated decryption of the dataset, and a
 * correct PIN is required before any data can be read at all.
 */

import { isInitialized, setupPin, unlock, lock } from './secureStore';

/**
 * Save a new PIN and initialize the encrypted store
 * (migrates any existing plaintext data from legacy installs).
 */
export async function savePIN(pin: string): Promise<void> {
  await setupPin(pin);
}

/**
 * Verify the PIN by unlocking the encrypted store.
 */
export async function verifyPIN(pin: string): Promise<boolean> {
  return unlock(pin);
}

/**
 * Check if a PIN has been set up.
 */
export async function hasPIN(): Promise<boolean> {
  return isInitialized();
}

/**
 * Lock the app: drops the key and decrypted data from memory.
 */
export function lockApp(): void {
  lock();
}
