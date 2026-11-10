import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  cycles: [] as unknown[],
  logs: [] as unknown[],
  settings: new Map<string, { key: string; value: string }>(),
  puts: [] as Array<{ key: string; value: string }>,
  encrypt: vi.fn(),
}));

vi.mock('dexie', () => {
  class MockDexie {
    version() {
      return {
        stores: () => {
          Object.assign(this, {
            cycles: {
              toArray: async () => [...mockState.cycles],
              clear: async () => { mockState.cycles = []; },
            },
            logs: {
              toArray: async () => [...mockState.logs],
              clear: async () => { mockState.logs = []; },
            },
            settings: {
              get: async (key: string) => mockState.settings.get(key),
              put: async (row: { key: string; value: string }) => {
                mockState.puts.push(row);
                mockState.settings.set(row.key, row);
              },
              delete: async (key: string) => { mockState.settings.delete(key); },
              clear: async () => { mockState.settings.clear(); },
            },
          });
        },
      };
    }
  }
  return { default: MockDexie };
});

vi.mock('../src/utils/encryption', () => ({
  deriveKey: vi.fn(async () => ({ testKey: true })),
  decrypt: vi.fn(),
  generateSalt: vi.fn(() => new Uint8Array([1, 2, 3, 4])),
  encrypt: (...args: unknown[]) => mockState.encrypt(...args),
}));

import {
  getDataset,
  isUnlocked,
  lock,
  setupPin,
  wipeAll,
  persist,
} from '../src/lib/secureStore';

const encoder = new TextEncoder();

function encryptedSnapshot(snapshot: string) {
  return { iv: new Uint8Array([9, 8, 7]), ciphertext: encoder.encode(snapshot).buffer };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

async function initialize() {
  mockState.encrypt.mockImplementation(async (snapshot: string) => encryptedSnapshot(snapshot));
  await setupPin('1234');
  mockState.puts = [];
  mockState.encrypt.mockReset();
  mockState.encrypt.mockImplementation(async (snapshot: string) => encryptedSnapshot(snapshot));
}

describe('encrypted storage write queue', () => {
  beforeEach(() => {
    mockState.cycles = [];
    mockState.logs = [];
    mockState.settings.clear();
    mockState.puts = [];
    mockState.encrypt.mockReset();
  });

  afterEach(async () => {
    if (isUnlocked()) lock();
  });

  it('keeps each captured snapshot and writes them in call order when encryption is delayed', async () => {
    await initialize();
    const firstEncryption = deferred<ReturnType<typeof encryptedSnapshot>>();
    const snapshots: string[] = [];
    mockState.encrypt.mockImplementation((snapshot: string) => {
      snapshots.push(snapshot);
      return snapshots.length === 1 ? firstEncryption.promise : Promise.resolve(encryptedSnapshot(snapshot));
    });

    getDataset().autoRetrain = false;
    const firstWrite = persist();
    getDataset().autoRetrain = true;
    const secondWrite = persist();

    await Promise.resolve();
    expect(snapshots).toHaveLength(1);
    expect(JSON.parse(snapshots[0]).autoRetrain).toBe(false);
    firstEncryption.resolve(encryptedSnapshot(snapshots[0]));
    await Promise.all([firstWrite, secondWrite]);

    expect(snapshots).toHaveLength(2);
    expect(JSON.parse(snapshots[1]).autoRetrain).toBe(true);
    expect(mockState.puts.map((row) => JSON.parse(row.value).data)).toEqual(
      snapshots.map((snapshot) => btoa(String.fromCharCode(...encoder.encode(snapshot))))
    );
  });

  it('continues the queue after a failed write', async () => {
    await initialize();
    mockState.encrypt
      .mockRejectedValueOnce(new Error('storage encryption failed'))
      .mockImplementationOnce(async (snapshot: string) => encryptedSnapshot(snapshot));

    await expect(persist()).rejects.toThrow('storage encryption failed');
    getDataset().autoRetrain = false;
    await expect(persist()).resolves.toBeUndefined();
    expect(mockState.puts).toHaveLength(1);
    expect(mockState.puts[0].key).toBe('encData');
  });

  it('waits for queued writes before clearing data and locking, so saves cannot resurrect it', async () => {
    await initialize();
    const encryption = deferred<ReturnType<typeof encryptedSnapshot>>();
    mockState.encrypt.mockImplementationOnce(() => encryption.promise);
    getDataset().autoRetrain = false;
    const pendingSave = persist();
    await Promise.resolve();

    let wiped = false;
    const wiping = wipeAll().then(() => { wiped = true; });
    await Promise.resolve();
    expect(isUnlocked()).toBe(false);
    expect(wiped).toBe(false);
    expect(mockState.settings.has('encSalt')).toBe(true);

    encryption.resolve(encryptedSnapshot(JSON.stringify({ autoRetrain: false })));
    await Promise.all([pendingSave, wiping]);
    expect(wiped).toBe(true);
    expect(mockState.settings.size).toBe(0);
    expect(mockState.cycles).toEqual([]);
    expect(mockState.logs).toEqual([]);
    expect(() => getDataset()).toThrow('locked');
    await expect(persist()).rejects.toThrow('locked');
  });
});
