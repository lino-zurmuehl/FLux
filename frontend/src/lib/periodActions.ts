/**
 * Gemeinsame Logik zum Starten/Beenden einer Periode.
 * Wird vom Hero-Kreis (Dashboard) und vom Perioden-Editor genutzt.
 */

import { differenceInCalendarDays } from 'date-fns';
import {
  addCycle,
  backupModelParamsBeforePeriodStart,
  getCycleByStartDate,
  recordPredictionOutcome,
  updateCycle,
  updatePredictionForNewCycle,
} from './db';
import type { Cycle } from './types';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export async function startPeriod(
  date: string,
  latestCycle: Cycle | null | undefined
): Promise<ActionResult> {
  if (latestCycle && !latestCycle.endDate) {
    return { ok: false, error: 'Beende zuerst die laufende Periode.' };
  }
  if (latestCycle && date <= latestCycle.startDate) {
    return { ok: false, error: 'Der neue Periodenstart muss nach dem letzten Startdatum liegen.' };
  }

  const existing = await getCycleByStartDate(date);
  if (existing) {
    return { ok: false, error: 'Für dieses Datum existiert bereits ein Periodenstart.' };
  }

  await backupModelParamsBeforePeriodStart();
  await recordPredictionOutcome(date);
  await addCycle({ startDate: date });
  await updatePredictionForNewCycle(date);
  return { ok: true };
}

export async function endPeriod(
  date: string,
  latestCycle: Cycle | null | undefined
): Promise<ActionResult> {
  if (!latestCycle?.id) {
    return { ok: false, error: 'Keine laufende Periode gefunden.' };
  }
  if (date < latestCycle.startDate) {
    return { ok: false, error: 'Das Enddatum kann nicht vor dem Startdatum liegen.' };
  }

  const periodLength =
    differenceInCalendarDays(new Date(date), new Date(latestCycle.startDate)) + 1;

  await updateCycle(latestCycle.id, { endDate: date, periodLength });
  return { ok: true };
}
