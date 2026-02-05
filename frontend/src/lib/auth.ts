/**
 * Authentication utilities for PIN-based app protection.
 * Uses Web Crypto API for secure hashing.
 */

import { db } from './db';

const SALT = 'FLux-PIN-Salt-2024'; // Static salt for PIN hashing

/**
 * Hash a PIN using SHA-256.
 */
export async function hashPIN(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + SALT);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Save PIN hash to settings.
 */
export async function savePIN(pin: string): Promise<void> {
  const hash = await hashPIN(pin);
  await db.settings.put({
    key: 'pinHash',
    value: hash,
  });
}

/**
 * Verify PIN against stored hash.
 */
export async function verifyPIN(pin: string): Promise<boolean> {
  const setting = await db.settings.get('pinHash');
  if (!setting) return false;

  const inputHash = await hashPIN(pin);
  return inputHash === setting.value;
}

/**
 * Check if a PIN has been set up.
 */
export async function hasPIN(): Promise<boolean> {
  const setting = await db.settings.get('pinHash');
  return setting !== null && setting !== undefined;
}

/**
 * Remove PIN (for settings reset).
 */
export async function removePIN(): Promise<void> {
  await db.settings.delete('pinHash');
}
