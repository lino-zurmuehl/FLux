/**
 * On-Device-Training: trainiert das Vorhersagemodell direkt in der App,
 * ohne Python.
 *
 * Zwei Modelle stehen zur Auswahl:
 * - weighted_average: 1:1-Nachbildung des Modells der Python-Pipeline
 *   (ml/models/cycle_predictor.py), rekursenz-gewichteter Durchschnitt.
 * - trend_regression: robuste lineare Trend-Regression (Theil-Sen) über
 *   die Zykluslängen. Entspricht dem, was die Prophet-Konfiguration der
 *   Pipeline (alle Saisonalitäten deaktiviert) effektiv berechnet.
 *
 * Bei jedem Training werden beide Modelle auf den vergangenen Zyklen
 * rückgetestet (Backtest); verwendet wird das Modell mit dem kleineren
 * mittleren Fehler.
 *
 * Gemeinsame Formeln, identisch zur Python-Implementierung:
 * - Zykluslängen: Abstand aufeinanderfolgender Starts, gültig sind 21..45 Tage
 * - Trend-Kennzahl: Mittel der letzten 3 minus Mittel der älteren
 * - Konfidenz: aus Variationskoeffizient plus Historien-Bonus
 * - Fruchtbares Fenster: Eisprung = nächste Periode - 14, Fenster = Eisprung-5..Eisprung
 */

import { getAllCycles, saveModelParams } from './db';
import type { Cycle, ModelParams, ModelType } from './types';

export const MIN_CYCLES_FOR_TRAINING = 3;

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

function addDaysLocal(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Populations-Standardabweichung (wie statistics.pstdev). */
function pstdev(values: number[]): number {
  if (values.length <= 1) return 0;
  const avg = mean(values);
  const variance = values.reduce((a, b) => a + (b - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Gültige Zykluslängen aus der Historie (entspricht _compute_cycle_lengths).
 */
export function computeValidCycleLengths(cycles: Cycle[]): number[] {
  const sorted = [...cycles].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const lengths: number[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    let length = sorted[i].length;
    if (length == null) {
      const start = parseISODateLocal(sorted[i].startDate);
      const nextStart = parseISODateLocal(sorted[i + 1].startDate);
      length = Math.round((nextStart.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    }
    const rounded = Math.round(length);
    if (rounded >= 21 && rounded <= 45) {
      lengths.push(rounded);
    }
  }

  return lengths;
}

/** Rekursenz-gewichteter Durchschnitt (entspricht _weighted_average). */
function weightedAverage(lengths: number[]): number {
  let weightedSum = 0;
  let weightTotal = 0;
  lengths.forEach((length, i) => {
    const weight = i + 1;
    weightedSum += length * weight;
    weightTotal += weight;
  });
  return Math.round(weightedSum / weightTotal);
}

/** Trend der Zykluslängen (entspricht _compute_trend). */
function computeTrend(lengths: number[]): number | undefined {
  if (lengths.length < 4) return undefined;
  const recent = mean(lengths.slice(-3));
  const older = mean(lengths.slice(0, -3));
  return recent - older;
}

/** Konfidenz aus Regelmäßigkeit und Historie (entspricht _compute_confidence). */
function computeConfidence(lengths: number[]): number {
  const avg = mean(lengths);
  const std = lengths.length > 1 ? pstdev(lengths) : 0;
  const cv = avg ? std / avg : 1;

  const consistency = 1 - Math.min(1, cv * 2.2);
  const historyBonus = Math.min(0.12, lengths.length * 0.02);
  const confidence = Math.max(0.15, Math.min(0.95, consistency + historyBonus));
  return Math.round(confidence * 100) / 100;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function clampLength(value: number): number {
  return Math.max(21, Math.min(45, Math.round(value)));
}

/**
 * Robuste Trend-Vorhersage (Theil-Sen): Median aller paarweisen Steigungen,
 * extrapoliert einen Schritt in die Zukunft. Bei zu wenigen Punkten
 * Rueckfall auf den gewichteten Durchschnitt.
 */
function trendRegressionPredict(lengths: number[]): number {
  const n = lengths.length;
  if (n < 4) return weightedAverage(lengths);

  const slopes: number[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      slopes.push((lengths[j] - lengths[i]) / (j - i));
    }
  }
  const slope = median(slopes);
  const intercept = median(lengths.map((y, x) => y - slope * x));

  return clampLength(intercept + slope * n);
}

const MODEL_PREDICTORS: Record<'weighted_average' | 'trend_regression', (lengths: number[]) => number> = {
  weighted_average: (lengths) => weightedAverage(lengths),
  trend_regression: (lengths) => trendRegressionPredict(lengths),
};

/**
 * Backtest: sagt jede vergangene Zykluslaenge nur aus den davor liegenden
 * voraus und misst den mittleren absoluten Fehler.
 */
function backtestMAE(
  lengths: number[],
  predict: (history: number[]) => number
): number | null {
  const errors: number[] = [];
  for (let i = MIN_CYCLES_FOR_TRAINING; i < lengths.length; i++) {
    const predicted = predict(lengths.slice(0, i));
    errors.push(Math.abs(predicted - lengths[i]));
  }
  return errors.length > 0 ? mean(errors) : null;
}

/**
 * Waehlt per Backtest das Modell mit dem kleineren Fehler.
 * Ohne ausreichende Historie (oder bei Gleichstand) gewinnt der
 * gewichtete Durchschnitt als einfacheres Modell.
 */
export function selectBestModel(lengths: number[]): {
  modelType: Extract<ModelType, 'weighted_average' | 'trend_regression'>;
  backtestErrors: { weighted_average: number | null; trend_regression: number | null };
} {
  const waError = backtestMAE(lengths, MODEL_PREDICTORS.weighted_average);
  const trError = backtestMAE(lengths, MODEL_PREDICTORS.trend_regression);

  const backtestErrors = { weighted_average: waError, trend_regression: trError };

  // Trend-Modell nur, wenn es im Backtest klar besser war
  const EPSILON = 0.05;
  if (waError !== null && trError !== null && trError < waError - EPSILON) {
    return { modelType: 'trend_regression', backtestErrors };
  }
  return { modelType: 'weighted_average', backtestErrors };
}

/** Prüft, ob genug Daten für ein Training vorhanden sind. */
export function canTrain(cycles: Cycle[]): boolean {
  return (
    cycles.length >= MIN_CYCLES_FOR_TRAINING &&
    computeValidCycleLengths(cycles).length >= MIN_CYCLES_FOR_TRAINING
  );
}

/**
 * Trainiert auf der Zyklushistorie und waehlt per Backtest das bessere
 * Modell (gewichteter Durchschnitt oder Trend-Regression).
 * Gibt null zurück, wenn zu wenige gültige Zyklen vorhanden sind.
 */
export function trainModel(cycles: Cycle[]): ModelParams | null {
  if (!canTrain(cycles)) return null;

  const sorted = [...cycles].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const validLengths = computeValidCycleLengths(sorted);

  const avgCycleLength = mean(validLengths);
  const stdCycleLength = pstdev(validLengths);
  const { modelType } = selectBestModel(validLengths);
  const predictedLength = MODEL_PREDICTORS[modelType](validLengths);
  const trend = computeTrend(validLengths);
  const confidence = computeConfidence(validLengths);

  const periodLengths = sorted
    .map((c) => c.periodLength)
    .filter((p): p is number => Boolean(p));
  const avgPeriodLength = periodLengths.length > 0 ? mean(periodLengths) : undefined;

  // Fruchtbares Fenster wie predict_fertile_window in der Python-Pipeline
  const lastStart = parseISODateLocal(sorted[sorted.length - 1].startDate);
  const nextPeriod = addDaysLocal(lastStart, predictedLength);
  const ovulation = addDaysLocal(nextPeriod, -14);
  const fertileStart = addDaysLocal(ovulation, -5);

  return {
    trainedAt: new Date().toISOString(),
    cyclesTrained: sorted.length,
    modelType,
    prediction: {
      nextPeriodDate: formatISODateLocal(nextPeriod),
      confidence,
      expectedCycleLength: predictedLength,
      fertileWindowStart: formatISODateLocal(fertileStart),
      fertileWindowEnd: formatISODateLocal(ovulation),
      periodLength: avgPeriodLength ? Math.round(avgPeriodLength) : undefined,
    },
    avgCycleLength,
    stdCycleLength,
    avgPeriodLength,
    recentCycleLengths: validLengths.slice(-6),
    trend,
  };
}

/**
 * Trainiert mit allen gespeicherten Zyklen neu und speichert das Ergebnis.
 * Gibt die neuen Parameter zurück, oder null wenn zu wenige Daten da sind.
 */
export async function retrainFromStoredCycles(): Promise<ModelParams | null> {
  const cycles = await getAllCycles();
  const params = trainModel(cycles);
  if (params) {
    await saveModelParams(params);
  }
  return params;
}
