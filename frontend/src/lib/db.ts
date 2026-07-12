/**
 * Data access layer.
 *
 * All sensitive data (cycles, logs, model parameters) is stored encrypted
 * at rest via lib/secureStore.ts: one AES-GCM encrypted dataset in
 * IndexedDB, keyed by a PIN-derived key (PBKDF2) that only lives in
 * memory while the app is unlocked.
 *
 * The functions below keep their original async signatures so pages and
 * components are unaffected by the storage change.
 */

import type { Cycle, DailyLog, ModelParams, PredictionRecord } from './types';
import { db, getDataset, persist, wipeAll } from './secureStore';

// Re-export the Dexie instance for backwards compatibility.
export { db };

function parseISODateLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
}

function formatISODateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function sortedCycles(): Cycle[] {
  return [...getDataset().cycles].sort((a, b) => a.startDate.localeCompare(b.startDate));
}

function sortedLogs(): DailyLog[] {
  return [...getDataset().logs].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Store model parameters.
 */
export async function saveModelParams(params: ModelParams): Promise<void> {
  const ds = getDataset();
  ds.modelParams = params;
  await persist();
}

/** Remove the current model after its source history has been deleted. */
export async function clearModelParams(): Promise<void> {
  const ds = getDataset();
  ds.modelParams = null;
  await persist();
}

/**
 * Get model parameters.
 */
export async function getModelParams(): Promise<ModelParams | null> {
  return getDataset().modelParams;
}

/**
 * Store current model params so an accidental period start can be undone safely.
 */
export async function backupModelParamsBeforePeriodStart(): Promise<void> {
  const ds = getDataset();
  if (!ds.modelParams) return;
  ds.modelParamsBackup = ds.modelParams;
  await persist();
}

/**
 * Restore model params backup created before a period start.
 */
export async function restoreModelParamsBackup(): Promise<boolean> {
  const ds = getDataset();
  if (!ds.modelParamsBackup) return false;
  ds.modelParams = ds.modelParamsBackup;
  ds.modelParamsBackup = null;
  await persist();
  return true;
}

/**
 * Clear stale model backup once a period start is confirmed.
 */
export async function clearModelParamsBackup(): Promise<void> {
  const ds = getDataset();
  ds.modelParamsBackup = null;
  await persist();
}

/**
 * Add a new cycle.
 */
export async function addCycle(cycle: Omit<Cycle, 'id'>): Promise<number> {
  const ds = getDataset();
  const id = ds.nextCycleId++;
  ds.cycles.push({ ...cycle, id });
  await persist();
  return id;
}

/**
 * Update an existing cycle.
 */
export async function updateCycle(
  id: number,
  updates: Partial<Cycle>
): Promise<void> {
  const ds = getDataset();
  const index = ds.cycles.findIndex((c) => c.id === id);
  if (index === -1) return;
  const startDateChanged =
    updates.startDate !== undefined && updates.startDate !== ds.cycles[index].startDate;
  // Properties explicitly set to undefined are removed on JSON
  // serialization, matching Dexie's previous update() semantics.
  ds.cycles[index] = { ...ds.cycles[index], ...updates, id };
  if (startDateChanged) {
    // A stored length describes the interval to the next start. Both the
    // edited cycle and its predecessor may now have a stale value.
    ds.cycles[index].length = undefined;
    const sorted = [...ds.cycles].sort((a, b) => a.startDate.localeCompare(b.startDate));
    const editedIndex = sorted.findIndex((cycle) => cycle.id === id);
    if (editedIndex > 0) sorted[editedIndex - 1].length = undefined;
  }
  await persist();
}

/**
 * Delete a cycle by id.
 */
export async function deleteCycle(id: number): Promise<void> {
  const ds = getDataset();
  const cycle = ds.cycles.find((c) => c.id === id);
  if (!cycle) return;
  const previous = [...ds.cycles]
    .filter((c) => c.id !== id && c.startDate < cycle.startDate)
    .sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
  ds.cycles = ds.cycles.filter((c) => c.id !== id);
  if (previous) previous.length = undefined;
  await persist();
}

/**
 * Delete a cycle and remove data that explicitly marks days in that period.
 * Other diary fields (symptoms, notes, temperature, etc.) are preserved.
 */
export async function deleteCycleAndRelatedData(id: number): Promise<Cycle | undefined> {
  const ds = getDataset();
  const cycle = ds.cycles.find((c) => c.id === id);
  if (!cycle) return undefined;

  const endDate = cycle.endDate ?? cycle.startDate;
  const previous = [...ds.cycles]
    .filter((c) => c.id !== id && c.startDate < cycle.startDate)
    .sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
  ds.cycles = ds.cycles.filter((c) => c.id !== id);
  if (previous) previous.length = undefined;
  ds.predictionHistory = ds.predictionHistory.filter(
    (record) => record.cycleStartDate !== cycle.startDate
  );
  ds.logs = ds.logs.map((log) => {
    if (log.date < cycle.startDate || log.date > endDate || (!log.flow && !log.isPeriod)) {
      return log;
    }
    const { flow: _flow, isPeriod: _isPeriod, ...rest } = log;
    return rest;
  });
  await persist();
  return cycle;
}

/**
 * Get all cycles sorted by date.
 */
export async function getAllCycles(): Promise<Cycle[]> {
  return sortedCycles();
}

/**
 * Get the most recent cycle.
 */
export async function getLatestCycle(): Promise<Cycle | undefined> {
  const cycles = sortedCycles();
  return cycles.length > 0 ? cycles[cycles.length - 1] : undefined;
}

/**
 * Get cycle by exact start date.
 */
export async function getCycleByStartDate(startDate: string): Promise<Cycle | undefined> {
  return getDataset().cycles.find((c) => c.startDate === startDate);
}

/**
 * Add a daily log entry (one log per date - existing entries are replaced).
 */
export async function addLog(log: Omit<DailyLog, 'id'>): Promise<number> {
  const ds = getDataset();
  const existing = ds.logs.find((l) => l.date === log.date);
  if (existing?.id != null) {
    const index = ds.logs.findIndex((l) => l.id === existing.id);
    ds.logs[index] = { ...log, id: existing.id };
    await persist();
    return existing.id;
  }
  const id = ds.nextLogId++;
  ds.logs.push({ ...log, id });
  await persist();
  return id;
}

/**
 * Get log for a specific date.
 */
export async function getLogByDate(date: string): Promise<DailyLog | undefined> {
  return getDataset().logs.find((l) => l.date === date);
}

/**
 * Get logs for a date range (inclusive).
 */
export async function getLogsInRange(
  startDate: string,
  endDate: string
): Promise<DailyLog[]> {
  return sortedLogs().filter((l) => l.date >= startDate && l.date <= endDate);
}

/**
 * Get all logs sorted by date.
 */
export async function getAllLogs(): Promise<DailyLog[]> {
  return sortedLogs();
}

/**
 * Delete all data from the database (including the PIN/encryption setup).
 */
export async function deleteAllData(): Promise<void> {
  await wipeAll();
}

/**
 * Export all data for ML retraining.
 */
export async function exportData(): Promise<{
  exportedAt: string;
  cycles: Cycle[];
  logs: DailyLog[];
  modelParams: ModelParams | null;
}> {
  return {
    exportedAt: new Date().toISOString(),
    cycles: sortedCycles(),
    logs: sortedLogs(),
    modelParams: getDataset().modelParams,
  };
}

/**
 * Import cycles from Flo export or app backup.
 * Deduplicates by startDate so re-importing the same file updates
 * existing cycles instead of creating duplicates.
 */
export async function importCycles(
  cycles: Cycle[]
): Promise<{ added: number; updated: number }> {
  const ds = getDataset();
  let added = 0;
  let updated = 0;

  for (const cycle of cycles) {
    // Never trust incoming ids - match on startDate instead.
    const { id: _id, ...data } = cycle;
    const index = ds.cycles.findIndex((c) => c.startDate === data.startDate);
    if (index !== -1) {
      ds.cycles[index] = { ...ds.cycles[index], ...data, id: ds.cycles[index].id };
      updated++;
    } else {
      ds.cycles.push({ ...data, id: ds.nextCycleId++ });
      added++;
    }
  }

  await persist();
  return { added, updated };
}

/**
 * Import logs from Flo export or app backup.
 * Deduplicates by date (one log per day) so re-importing the same
 * file updates existing entries instead of creating duplicates.
 */
export async function importLogs(
  logs: DailyLog[]
): Promise<{ added: number; updated: number }> {
  const ds = getDataset();
  let added = 0;
  let updated = 0;

  for (const log of logs) {
    const { id: _id, ...data } = log;
    const index = ds.logs.findIndex((l) => l.date === data.date);
    if (index !== -1) {
      ds.logs[index] = { ...ds.logs[index], ...data, id: ds.logs[index].id };
      updated++;
    } else {
      ds.logs.push({ ...data, id: ds.nextLogId++ });
      added++;
    }
  }

  await persist();
  return { added, updated };
}

/**
 * Check if the app has been set up (has cycles or model params).
 */
export async function hasData(): Promise<boolean> {
  const ds = getDataset();
  return ds.cycles.length > 0 || ds.modelParams !== null;
}

/**
 * Update prediction when a new period starts.
 * Shifts nextPeriodDate by the model's expected cycle length and
 * recomputes the fertile window with the same definition the ML
 * pipeline uses: ovulation = next period - 14 days, fertile window =
 * ovulation - 5 days ... ovulation.
 */
export async function updatePredictionForNewCycle(cycleStartDate: string): Promise<void> {
  const modelParams = await getModelParams();
  if (!modelParams?.prediction) return;

  // Prefer the trained prediction's cycle length (e.g. Prophet output);
  // fall back to the historical average if it's missing/invalid.
  const rawLength = modelParams.prediction.expectedCycleLength;
  const cycleLength = Math.round(
    Number.isFinite(rawLength) && rawLength > 0 ? rawLength : modelParams.avgCycleLength
  );

  const startDate = parseISODateLocal(cycleStartDate);
  const nextPeriodDate = new Date(startDate);
  nextPeriodDate.setDate(nextPeriodDate.getDate() + cycleLength);

  // Same fertile-window definition as ml/preprocessing/feature_engineering.py
  const ovulationOffset = cycleLength - 14;
  const fertileStart = new Date(startDate);
  fertileStart.setDate(fertileStart.getDate() + ovulationOffset - 5);
  const fertileEnd = new Date(startDate);
  fertileEnd.setDate(fertileEnd.getDate() + ovulationOffset);

  const updatedParams: ModelParams = {
    ...modelParams,
    prediction: {
      ...modelParams.prediction,
      nextPeriodDate: formatISODateLocal(nextPeriodDate),
      fertileWindowStart: formatISODateLocal(fertileStart),
      fertileWindowEnd: formatISODateLocal(fertileEnd),
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
    today.setHours(12, 0, 0, 0);
    const startDate = parseISODateLocal(latestCycle.startDate);
    const diffTime = today.getTime() - startDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays + 1; // Day 1 is the first day of period
  }

  // Fallback: calculate from model params prediction
  const modelParams = await getModelParams();
  if (modelParams?.prediction) {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const nextPeriod = parseISODateLocal(modelParams.prediction.nextPeriodDate);
    const diffTime = nextPeriod.getTime() - today.getTime();
    const daysUntilPeriod = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const cycleLength = Math.max(1, Math.round(modelParams.prediction.expectedCycleLength));
    const rawCycleDay = cycleLength - daysUntilPeriod;
    // Keep cycle day in a realistic 1..cycleLength range even if prediction date is stale.
    return ((rawCycleDay - 1) % cycleLength + cycleLength) % cycleLength + 1;
  }

  return null;
}

/**
 * Record how accurate the current prediction was, right before a new
 * period start shifts it. Call BEFORE updatePredictionForNewCycle.
 * Deduplicates by actual start date.
 */
export async function recordPredictionOutcome(actualStartDate: string): Promise<void> {
  const ds = getDataset();
  const prediction = ds.modelParams?.prediction;
  if (!prediction?.nextPeriodDate) return;

  const actual = parseISODateLocal(actualStartDate);
  const predicted = parseISODateLocal(prediction.nextPeriodDate);
  const errorDays = Math.round(
    (actual.getTime() - predicted.getTime()) / (1000 * 60 * 60 * 24)
  );

  const record = {
    cycleStartDate: actualStartDate,
    predictedDate: prediction.nextPeriodDate,
    errorDays,
    confidence: prediction.confidence,
    modelType: ds.modelParams?.modelType,
  };

  const index = ds.predictionHistory.findIndex(
    (r) => r.cycleStartDate === actualStartDate
  );
  if (index !== -1) {
    ds.predictionHistory[index] = record;
  } else {
    ds.predictionHistory.push(record);
  }
  await persist();
}

/**
 * Remove the accuracy record for a period start (e.g. when the start
 * is undone).
 */
export async function removePredictionRecord(cycleStartDate: string): Promise<void> {
  const ds = getDataset();
  const before = ds.predictionHistory.length;
  ds.predictionHistory = ds.predictionHistory.filter(
    (r) => r.cycleStartDate !== cycleStartDate
  );
  if (ds.predictionHistory.length !== before) await persist();
}

/**
 * Keep the accuracy record in sync when a period start date is corrected.
 */
export async function updatePredictionRecordStartDate(
  oldStartDate: string,
  newStartDate: string
): Promise<void> {
  const ds = getDataset();
  const record = ds.predictionHistory.find((r) => r.cycleStartDate === oldStartDate);
  if (!record) return;

  const actual = parseISODateLocal(newStartDate);
  const predicted = parseISODateLocal(record.predictedDate);
  record.cycleStartDate = newStartDate;
  record.errorDays = Math.round(
    (actual.getTime() - predicted.getTime()) / (1000 * 60 * 60 * 24)
  );
  await persist();
}

/**
 * Get all recorded prediction outcomes sorted by cycle start date.
 */
export async function getPredictionHistory(): Promise<PredictionRecord[]> {
  return [...getDataset().predictionHistory].sort((a, b) =>
    a.cycleStartDate.localeCompare(b.cycleStartDate)
  );
}

/**
 * Whether the on-device model should retrain automatically after
 * each logged period.
 */
export async function getAutoRetrain(): Promise<boolean> {
  return getDataset().autoRetrain;
}

export async function setAutoRetrain(enabled: boolean): Promise<void> {
  const ds = getDataset();
  ds.autoRetrain = enabled;
  await persist();
}
