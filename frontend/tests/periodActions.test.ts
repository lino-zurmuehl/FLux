import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({ dataset: null as any, persist: vi.fn() }));

vi.mock('../src/lib/secureStore', () => ({
  db: {},
  getDataset: () => store.dataset,
  persist: store.persist,
  wipeAll: vi.fn(),
}));

import {
  autoEndPeriods,
  getLatestCycle,
  getPredictionHistory,
  saveModelParams,
} from '../src/lib/db';
import { endPeriod, saveCalendarPeriod, startPeriod } from '../src/lib/periodActions';
import { trainModel } from '../src/lib/trainer';
import type { Cycle, DailyLog, ModelParams, PredictionRecord } from '../src/lib/types';
import type { Dataset } from '../src/lib/secureStore';

function emptyDataset(): Dataset {
  return {
    cycles: [] as Cycle[],
    logs: [] as DailyLog[],
    modelParams: null as ModelParams | null,
    modelParamsBackup: null as ModelParams | null,
    predictionHistory: [] as PredictionRecord[],
    autoRetrain: false,
    nextCycleId: 1,
    nextLogId: 1,
  };
}

function modelParams(): ModelParams {
  return {
    trainedAt: '2026-01-01T00:00:00.000Z',
    cyclesTrained: 4,
    modelType: 'weighted_average',
    prediction: {
      nextPeriodDate: '2026-10-20',
      confidence: 0.8,
      expectedCycleLength: 28,
      periodLength: 5,
    },
    avgCycleLength: 28,
    stdCycleLength: 0,
    recentCycleLengths: [28, 28, 28],
  };
}

describe('period actions and persistence', () => {
  afterEach(() => vi.useRealTimers());

  beforeEach(() => {
    store.dataset = emptyDataset();
    store.persist.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 10, 12));
  });

  it('persists automatic ends once and leaves manual ends untouched', async () => {
    store.dataset.cycles = [
      { id: 1, startDate: '2026-10-01' },
      { id: 2, startDate: '2026-09-01', endDate: '2026-09-04', periodLength: 4, autoEnded: false },
    ];
    expect(await autoEndPeriods('2026-10-06')).toBe(true);
    expect(store.dataset.cycles.find((c: Cycle) => c.id === 1)).toMatchObject({
      endDate: '2026-10-05', periodLength: 5, autoEnded: true,
    });
    expect(store.dataset.cycles.find((c: Cycle) => c.id === 2)).toMatchObject({
      endDate: '2026-09-04', periodLength: 4, autoEnded: false,
    });
    expect(await autoEndPeriods('2026-10-20')).toBe(false);
    expect(store.persist).toHaveBeenCalledTimes(1);
  });

  it('inserts a missing historical period, clears cached interval lengths, and anchors prediction at latest start', async () => {
    store.dataset.cycles = [
      { id: 1, startDate: '2026-06-01', endDate: '2026-06-05', length: 29 },
      { id: 2, startDate: '2026-07-01', endDate: '2026-07-05', length: 30 },
      { id: 3, startDate: '2026-07-31', endDate: '2026-08-04', length: 28 },
      { id: 4, startDate: '2026-08-28', endDate: '2026-09-01', length: 29 },
    ];
    store.dataset.nextCycleId = 5;
    await saveModelParams(modelParams());

    const result = await saveCalendarPeriod('2026-07-15', '2026-07-19');
    expect(result.ok).toBe(true);
    expect(store.dataset.cycles.every((cycle: Cycle) => cycle.length === undefined)).toBe(true);
    expect((await getLatestCycle())?.startDate).toBe('2026-08-28');
    expect(store.dataset.modelParams?.prediction.nextPeriodDate).toBe('2026-09-25');
  });

  it('moves an accuracy record with a corrected start date and recomputes its error', async () => {
    store.dataset.cycles = [{ id: 1, startDate: '2026-09-01', endDate: '2026-09-05', periodLength: 5 }];
    store.dataset.predictionHistory = [{
      cycleStartDate: '2026-09-01', predictedDate: '2026-09-03', errorDays: -2, confidence: 0.7,
    }];
    const result = await saveCalendarPeriod('2026-09-02', '2026-09-06', 1);
    expect(result.ok).toBe(true);
    expect(await getPredictionHistory()).toMatchObject([
      { cycleStartDate: '2026-09-02', predictedDate: '2026-09-03', errorDays: -1 },
    ]);
  });

  it('rejects invalid actions without mutating or persisting data', async () => {
    store.dataset.cycles = [{ id: 1, startDate: '2026-10-01', endDate: '2026-10-05', periodLength: 5 }];
    const before = structuredClone(store.dataset);
    const result = await saveCalendarPeriod('2026-10-03', '2026-10-07');
    expect(result.ok).toBe(false);
    expect(store.dataset).toEqual(before);
    expect(store.persist).not.toHaveBeenCalled();

    const startResult = await startPeriod('2026-10-11', null);
    expect(startResult.ok).toBe(false);
    expect(store.dataset).toEqual(before);
  });

  it('rejects future starts, future ends, and attempts to end an already closed period', async () => {
    store.dataset.cycles = [{ id: 1, startDate: '2026-10-01' }];
    let before = structuredClone(store.dataset);
    expect((await startPeriod('2026-10-11', null)).ok).toBe(false);
    expect((await endPeriod('2026-10-11', null)).ok).toBe(false);
    expect(store.dataset).toEqual(before);
    expect(store.persist).not.toHaveBeenCalled();

    store.dataset.cycles[0].endDate = '2026-10-05';
    store.dataset.cycles[0].periodLength = 5;
    before = structuredClone(store.dataset);
    expect((await endPeriod('2026-10-06', null)).ok).toBe(false);
    expect(store.dataset).toEqual(before);
    expect(store.persist).not.toHaveBeenCalled();
  });

  it('excludes assumed period lengths from frontend model duration averages', () => {
    const cycles: Cycle[] = [
      { startDate: '2026-01-01', length: 28, periodLength: 9, autoEnded: true },
      { startDate: '2026-01-29', length: 30, periodLength: 4 },
      { startDate: '2026-02-28', length: 29, periodLength: 8, autoEnded: true },
      { startDate: '2026-03-29', periodLength: 3 },
    ];
    const model = trainModel(cycles);
    expect(model?.avgPeriodLength).toBe(3.5);
    expect(model?.prediction.periodLength).toBe(4);
    expect(model?.avgCycleLength).toBeCloseTo(29);
  });
});
