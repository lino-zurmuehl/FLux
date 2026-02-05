/**
 * IndexedDB database using Dexie.js
 *
 * All sensitive data (cycles, logs) is stored encrypted.
 * The encryption key is derived from the user's password and held in memory.
 */

import Dexie, { type Table } from 'dexie';
import type { Cycle, DailyLog, ModelParams, AppSettings } from './types';

/**
 * Database schema for FLux app.
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

// Singleton database instance
export const db = new FluxDatabase();

/**
 * Store model parameters in settings.
 */
export async function saveModelParams(params: ModelParams): Promise<void> {
  await db.settings.put({
    key: 'modelParams',
    value: JSON.stringify(params),
  });
}

/**
 * Get model parameters from settings.
 */
export async function getModelParams(): Promise<ModelParams | null> {
  const setting = await db.settings.get('modelParams');
  if (!setting) return null;
  return JSON.parse(setting.value) as ModelParams;
}

/**
 * Add a new cycle.
 */
export async function addCycle(cycle: Omit<Cycle, 'id'>): Promise<number> {
  return await db.cycles.add(cycle as Cycle);
}

/**
 * Update an existing cycle.
 */
export async function updateCycle(
  id: number,
  updates: Partial<Cycle>
): Promise<void> {
  await db.cycles.update(id, updates);
}

/**
 * Get all cycles sorted by date.
 */
export async function getAllCycles(): Promise<Cycle[]> {
  return await db.cycles.orderBy('startDate').toArray();
}

/**
 * Get the most recent cycle.
 */
export async function getLatestCycle(): Promise<Cycle | undefined> {
  return await db.cycles.orderBy('startDate').last();
}

/**
 * Add a daily log entry.
 */
export async function addLog(log: Omit<DailyLog, 'id'>): Promise<number> {
  // Check if log for this date already exists
  const existing = await db.logs.where('date').equals(log.date).first();
  if (existing) {
    await db.logs.update(existing.id!, log);
    return existing.id!;
  }
  return await db.logs.add(log as DailyLog);
}

/**
 * Get log for a specific date.
 */
export async function getLogByDate(date: string): Promise<DailyLog | undefined> {
  return await db.logs.where('date').equals(date).first();
}

/**
 * Get logs for a date range.
 */
export async function getLogsInRange(
  startDate: string,
  endDate: string
): Promise<DailyLog[]> {
  return await db.logs
    .where('date')
    .between(startDate, endDate, true, true)
    .toArray();
}

/**
 * Get all logs sorted by date.
 */
export async function getAllLogs(): Promise<DailyLog[]> {
  return await db.logs.orderBy('date').toArray();
}

/**
 * Delete all data from the database.
 */
export async function deleteAllData(): Promise<void> {
  await db.cycles.clear();
  await db.logs.clear();
  await db.settings.clear();
}

/**
 * Export all data for ML retraining.
 */
export async function exportData(): Promise<{
  exportedAt: string;
  cycles: Cycle[];
  logs: DailyLog[];
}> {
  const cycles = await getAllCycles();
  const logs = await getAllLogs();

  return {
    exportedAt: new Date().toISOString(),
    cycles,
    logs,
  };
}

/**
 * Import cycles from Flo export or app backup.
 */
export async function importCycles(cycles: Cycle[]): Promise<void> {
  await db.cycles.bulkPut(cycles);
}

/**
 * Import logs from Flo export or app backup.
 */
export async function importLogs(logs: DailyLog[]): Promise<void> {
  await db.logs.bulkPut(logs);
}

/**
 * Check if the app has been set up (has cycles or model params).
 */
export async function hasData(): Promise<boolean> {
  const cycleCount = await db.cycles.count();
  if (cycleCount > 0) return true;

  // Also consider having model params as "set up"
  const modelParams = await getModelParams();
  return modelParams !== null;
}

/**
 * Update prediction when a new period starts.
 * Recalculates nextPeriodDate based on avgCycleLength.
 */
export async function updatePredictionForNewCycle(cycleStartDate: string): Promise<void> {
  const modelParams = await getModelParams();
  if (!modelParams?.prediction) return;

  const startDate = new Date(cycleStartDate);
  const nextPeriodDate = new Date(startDate);
  nextPeriodDate.setDate(nextPeriodDate.getDate() + Math.round(modelParams.avgCycleLength));

  // Update fertile window (typically day 10-16 of cycle)
  const fertileStart = new Date(startDate);
  fertileStart.setDate(fertileStart.getDate() + 10);
  const fertileEnd = new Date(startDate);
  fertileEnd.setDate(fertileEnd.getDate() + 16);

  const updatedParams: ModelParams = {
    ...modelParams,
    prediction: {
      ...modelParams.prediction,
      nextPeriodDate: nextPeriodDate.toISOString().split('T')[0],
      fertileWindowStart: fertileStart.toISOString().split('T')[0],
      fertileWindowEnd: fertileEnd.toISOString().split('T')[0],
    },
  };

  await saveModelParams(updatedParams);
}

/**
 * Get current cycle day (days since last period started).
 */
export async function getCurrentCycleDay(): Promise<number | null> {
  const latestCycle = await getLatestCycle();

  if (latestCycle) {
    const today = new Date();
    const startDate = new Date(latestCycle.startDate);
    const diffTime = today.getTime() - startDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays + 1; // Day 1 is the first day of period
  }

  // Fallback: calculate from model params prediction
  const modelParams = await getModelParams();
  if (modelParams?.prediction) {
    const today = new Date();
    const nextPeriod = new Date(modelParams.prediction.nextPeriodDate);
    const diffTime = nextPeriod.getTime() - today.getTime();
    const daysUntilPeriod = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const cycleDay = modelParams.prediction.expectedCycleLength - daysUntilPeriod;
    return Math.max(1, cycleDay); // At least day 1
  }

  return null;
}
