/**
 * Encrypted at-rest storage for all health data.
 *
 * All cycles, daily logs and model parameters are kept in ONE dataset that
 * is encrypted with AES-GCM before it is written to IndexedDB. The AES key
 * is derived from the user's PIN via PBKDF2 (480k iterations, random salt)
 * and only ever held in memory. Without the correct PIN the database
 * contains nothing readable - PIN verification IS the successful
 * (authenticated) decryption of the dataset.
 *
 * Legacy installs (plaintext cycles/logs tables + SHA-256 pinHash) are
 * migrated transparently on the first successful unlock.
 */

import Dexie, { type Table } from 'dexie';
import { deriveKey, encrypt, decrypt, generateSalt } from '../utils/encryption';
import type { Cycle, DailyLog, ModelParams, AppSettings, PredictionRecord } from './types';

const ENC_SALT_KEY = 'encSalt';
const ENC_DATA_KEY = 'encData';
const LEGACY_PIN_HASH_KEY = 'pinHash';
const LEGACY_MODEL_PARAMS_KEY = 'modelParams';
const LEGACY_MODEL_BACKUP_KEY = 'modelParamsBeforePeriodStart';
const LEGACY_PIN_SALT = 'FLux-PIN-Salt-2024';

/**
 * The complete decrypted application dataset held in memory while unlocked.
 */
export interface Dataset {
  cycles: Cycle[];
  logs: DailyLog[];
  modelParams: ModelParams | null;
  modelParamsBackup: ModelParams | null;
  predictionHistory: PredictionRecord[];
  autoRetrain: boolean;
  nextCycleId: number;
  nextLogId: number;
}

/**
 * Dexie database. The cycles/logs tables only exist to migrate legacy
 * plaintext data; new data lives encrypted inside the settings table.
 */
export class FluxDatabase extends Dexie {
  cycles!: Table<Cycle, number>;
  logs!: Table<DailyLog, number>;
  settings!: Table<AppSettings, string>;

  constructor() {
    super('flux');

    this.version(1).stores({
      cycles: '++id, startDate',
      logs: '++id, date',
      settings: 'key',
    });
  }
}

export const db = new FluxDatabase();

// In-memory session state - never persisted.
let currentKey: CryptoKey | null = null;
let currentDataset: Dataset | null = null;

function toBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function emptyDataset(): Dataset {
  return {
    cycles: [],
    logs: [],
    modelParams: null,
    modelParamsBackup: null,
    predictionHistory: [],
    autoRetrain: true,
    nextCycleId: 1,
    nextLogId: 1,
  };
}

function maxId(records: { id?: number }[]): number {
  return records.reduce((max, r) => Math.max(max, r.id ?? 0), 0);
}

/** Legacy PIN hash (SHA-256 with static salt) - only used for migration. */
async function legacyHashPIN(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + LEGACY_PIN_SALT);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Read any legacy plaintext data into a dataset (empty tables -> empty). */
async function readLegacyDataset(): Promise<Dataset> {
  const cycles = await db.cycles.toArray();
  const logs = await db.logs.toArray();
  const modelRow = await db.settings.get(LEGACY_MODEL_PARAMS_KEY);
  const backupRow = await db.settings.get(LEGACY_MODEL_BACKUP_KEY);

  return {
    cycles,
    logs,
    modelParams: modelRow ? (JSON.parse(modelRow.value) as ModelParams) : null,
    modelParamsBackup: backupRow ? (JSON.parse(backupRow.value) as ModelParams) : null,
    predictionHistory: [],
    autoRetrain: true,
    nextCycleId: maxId(cycles) + 1,
    nextLogId: maxId(logs) + 1,
  };
}

/** Remove all legacy plaintext data after successful migration. */
async function clearLegacyData(): Promise<void> {
  await db.cycles.clear();
  await db.logs.clear();
  await db.settings.delete(LEGACY_PIN_HASH_KEY);
  await db.settings.delete(LEGACY_MODEL_PARAMS_KEY);
  await db.settings.delete(LEGACY_MODEL_BACKUP_KEY);
}

/** Whether a PIN has been set up (new encrypted format or legacy hash). */
export async function isInitialized(): Promise<boolean> {
  const salt = await db.settings.get(ENC_SALT_KEY);
  if (salt) return true;
  const legacyHash = await db.settings.get(LEGACY_PIN_HASH_KEY);
  return Boolean(legacyHash);
}

export function isUnlocked(): boolean {
  return currentKey !== null && currentDataset !== null;
}

/** Access the decrypted dataset. Throws when the store is locked. */
export function getDataset(): Dataset {
  if (!currentDataset) {
    throw new Error('Secure store is locked - unlock with the PIN first.');
  }
  return currentDataset;
}

/** Encrypt the current dataset and write it to IndexedDB. */
export async function persist(): Promise<void> {
  if (!currentKey || !currentDataset) {
    throw new Error('Secure store is locked - unlock with the PIN first.');
  }
  const { iv, ciphertext } = await encrypt(JSON.stringify(currentDataset), currentKey);
  await db.settings.put({
    key: ENC_DATA_KEY,
    value: JSON.stringify({ iv: toBase64(iv), data: toBase64(ciphertext) }),
  });
}

/** Drop the key and decrypted data from memory (app lock). */
export function lock(): void {
  currentKey = null;
  currentDataset = null;
}

/**
 * First-time PIN setup. Also migrates any existing plaintext data
 * (e.g. when a legacy install never completed migration).
 */
export async function setupPin(pin: string): Promise<void> {
  const salt = generateSalt();
  const key = await deriveKey(pin, salt);
  const dataset = await readLegacyDataset();

  currentKey = key;
  currentDataset = dataset;

  // Write the encrypted blob before the salt so a half-finished setup
  // never leaves a salt without data behind.
  await persist();
  await db.settings.put({ key: ENC_SALT_KEY, value: toBase64(salt) });
  await clearLegacyData();
}

/**
 * Unlock with the PIN. Returns true when the PIN is correct.
 * Handles both the encrypted format and legacy (plaintext + hash) installs.
 */
export async function unlock(pin: string): Promise<boolean> {
  const saltRow = await db.settings.get(ENC_SALT_KEY);
  const dataRow = await db.settings.get(ENC_DATA_KEY);

  if (saltRow && dataRow) {
    try {
      const key = await deriveKey(pin, fromBase64(saltRow.value));
      const payload = JSON.parse(dataRow.value) as { iv: string; data: string };
      const plaintext = await decrypt(
        fromBase64(payload.data).buffer as ArrayBuffer,
        key,
        fromBase64(payload.iv)
      );
      currentKey = key;
      const parsed = JSON.parse(plaintext) as Dataset;
      // Datasets written by older app versions lack newer fields.
      if (!Array.isArray(parsed.predictionHistory)) parsed.predictionHistory = [];
      if (typeof parsed.autoRetrain !== 'boolean') parsed.autoRetrain = true;
      currentDataset = parsed;
      return true;
    } catch {
      // AES-GCM is authenticated: a wrong PIN fails decryption.
      return false;
    }
  }

  // Legacy install: verify the old hash, then migrate to encrypted storage.
  const pinHashRow = await db.settings.get(LEGACY_PIN_HASH_KEY);
  if (pinHashRow) {
    const inputHash = await legacyHashPIN(pin);
    if (inputHash !== pinHashRow.value) return false;
    await setupPin(pin);
    return true;
  }

  return false;
}

/** Delete ALL data (encrypted blob, salt, legacy tables) and lock. */
export async function wipeAll(): Promise<void> {
  await db.cycles.clear();
  await db.logs.clear();
  await db.settings.clear();
  lock();
}

/** Create a fresh empty dataset (used indirectly by tests/setup). */
export { emptyDataset };
