/**
 * Gemeinsame Logik zum Starten/Beenden einer Periode.
 * Wird von Dashboard, Schnellaktionen und Tageseintrag genutzt.
 *
 * Nach jedem erfassten Periodenstart/-ende wird das On-Device-Modell
 * automatisch neu trainiert (sofern aktiviert und genug Daten da sind).
 */

import { differenceInCalendarDays } from 'date-fns';
import {
  addCycle,
  backupModelParamsBeforePeriodStart,
  getAutoRetrain,
  getCycleByStartDate,
  recordPredictionOutcome,
  updateCycle,
  updatePredictionForNewCycle,
} from './db';
import { retrainFromStoredCycles } from './trainer';
import type { Cycle } from './types';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

/**
 * Trainiert das Modell neu, wenn Auto-Training aktiv ist und genug
 * Zyklen vorhanden sind. Gibt true zurück, wenn trainiert wurde.
 */
export async function maybeAutoRetrain(): Promise<boolean> {
  const enabled = await getAutoRetrain();
  if (!enabled) return false;
  const params = await retrainFromStoredCycles();
  return params !== null;
}

/**
 * Führt einen bestätigten Periodenstart aus (ohne Validierung):
 * Backup, Genauigkeits-Aufzeichnung, neuer Zyklus, dann Neu-Training
 * bzw. Verschieben der bestehenden Vorhersage.
 */
export async function applyPeriodStart(date: string): Promise<void> {
  await backupModelParamsBeforePeriodStart();
  await recordPredictionOutcome(date);
  await addCycle({ startDate: date });

  const retrained = await maybeAutoRetrain();
  if (!retrained) {
    await updatePredictionForNewCycle(date);
  }
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

  await applyPeriodStart(date);
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

  // Periodenlänge fließt in avgPeriodLength ein
  await maybeAutoRetrain();

  return { ok: true };
}
