import { describe, expect, it } from 'vitest';
import type { Cycle } from '../src/lib/types';
import {
  MIN_PERIOD_STARTS_FOR_TRAINING,
  MIN_VALID_CYCLE_LENGTHS,
  canTrain,
  computeValidCycleLengths,
  selectBestModel,
  trainModel,
} from '../src/lib/trainer';

function cyclesFromLengths(lengths: number[]): Cycle[] {
  const starts = ['2026-01-01'];
  for (const length of lengths) {
    const previous = new Date(`${starts[starts.length - 1]}T12:00:00`);
    previous.setDate(previous.getDate() + length);
    starts.push(previous.toISOString().slice(0, 10));
  }

  return starts.map((startDate, index) => ({
    id: index + 1,
    startDate,
    length: index < lengths.length ? lengths[index] : undefined,
  }));
}

describe('on-device trainer', () => {
  it('requires completed intervals, not just three period records', () => {
    expect(MIN_VALID_CYCLE_LENGTHS).toBe(3);
    expect(MIN_PERIOD_STARTS_FOR_TRAINING).toBe(4);
    expect(canTrain(cyclesFromLengths([28, 29]))).toBe(false);
    expect(canTrain(cyclesFromLengths([28, 29, 30]))).toBe(true);
  });

  it('filters implausible cycle lengths', () => {
    const cycles = cyclesFromLengths([28, 10, 46, 30, 29]);
    expect(computeValidCycleLengths(cycles)).toEqual([28, 30, 29]);
    expect(canTrain(cycles)).toBe(true);
  });

  it('sorts cycles before calculating intervals', () => {
    const cycles = cyclesFromLengths([28, 29, 30, 31]).reverse();
    expect(computeValidCycleLengths(cycles)).toEqual([28, 29, 30, 31]);
  });

  it('does not claim a backtest when there is no holdout history', () => {
    const result = selectBestModel([28, 29, 30, 31]);
    expect(result.backtestPerformed).toBe(false);
    expect(result.backtestErrors).toEqual({ weighted_average: null, trend_regression: null });
    expect(result.modelType).toBe('weighted_average');
  });

  it('runs a real backtest once enough history exists', () => {
    const result = selectBestModel([28, 29, 30, 31, 32]);
    expect(result.backtestPerformed).toBe(true);
    expect(result.backtestErrors.weighted_average).not.toBeNull();
    expect(result.backtestErrors.trend_regression).not.toBeNull();
  });

  it('produces a calendar-safe prediction and fertile window', () => {
    const params = trainModel(cyclesFromLengths([28, 29, 30]));
    expect(params).not.toBeNull();
    expect(params?.prediction.nextPeriodDate).toBe('2026-04-27');
    expect(params?.prediction.fertileWindowStart).toBe('2026-04-08');
    expect(params?.prediction.fertileWindowEnd).toBe('2026-04-13');
    expect(params?.prediction.confidence).toBeGreaterThanOrEqual(0.15);
    expect(params?.prediction.confidence).toBeLessThanOrEqual(0.95);
  });
});
