/**
 * Gemeinsame Logik zum Starten/Beenden einer Periode.
 * Wird von Dashboard, Schnellaktionen und Tageseintrag genutzt.
 *
 * Nach jedem erfassten Periodenstart/-ende wird das On-Device-Modell
 * automatisch neu trainiert (sofern aktiviert und genug Daten da sind).
 */

import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import {
  addCycle,
  backupModelParamsBeforePeriodStart,
  getAutoRetrain,
  getCycleByStartDate,
  getAllCycles,
  getLatestCycle,
  recordPredictionOutcome,
  updateCycle,
  updatePredictionForNewCycle,
  savePeriodDates,
  deleteCycleAndRelatedData,
  clearModelParams,
  clearModelParamsBackup,
} from './db';
import { validatePeriodDates } from './periodDates';
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
  latestCycle = await getLatestCycle();
  const error = validatePeriodDates(date, undefined, await getAllCycles(), format(new Date(), 'yyyy-MM-dd'));
  if (error) return { ok: false, error };
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
  latestCycle = await getLatestCycle();
  if (!latestCycle?.id) {
    return { ok: false, error: 'Keine laufende Periode gefunden.' };
  }
  if (date < latestCycle.startDate) {
    return { ok: false, error: 'Das Enddatum kann nicht vor dem Startdatum liegen.' };
  }
  if (latestCycle.endDate) return { ok: false, error: 'Diese Periode wurde bereits beendet. Korrigiere sie im Kalender.' };
  const error = validatePeriodDates(latestCycle.startDate, date, await getAllCycles(), format(new Date(), 'yyyy-MM-dd'), latestCycle.id);
  if (error) return { ok: false, error };

  const periodLength =
    differenceInCalendarDays(parseISO(date), parseISO(latestCycle.startDate)) + 1;

  await updateCycle(latestCycle.id, { endDate: date, periodLength, autoEnded: false });

  // Periodenlänge fließt in avgPeriodLength ein
  await maybeAutoRetrain();

  return { ok: true };
}

/** Historical additions must keep the prediction anchored to the latest start. */
export async function saveCalendarPeriod(start: string, end?: string, id?: number): Promise<ActionResult> {
  const cycles = await getAllCycles();
  const error = validatePeriodDates(start, end, cycles, format(new Date(), 'yyyy-MM-dd'), id);
  if (error) return { ok: false, error };
  const latest = cycles[cycles.length - 1];
  if (id === undefined && (!latest || start > latest.startDate)) {
    await backupModelParamsBeforePeriodStart();
    await recordPredictionOutcome(start);
  }
  await savePeriodDates(start, end, id);
  const retrained = await maybeAutoRetrain();
  if (!retrained) {
    const current = await getLatestCycle();
    if (current) await updatePredictionForNewCycle(current.startDate);
  }
  return { ok: true };
}

export async function deleteCalendarPeriod(id: number): Promise<void> {
  await deleteCycleAndRelatedData(id);
  const latest = await getLatestCycle();
  if (!latest) {
    await clearModelParams();
    await clearModelParamsBackup();
  } else if (!(await maybeAutoRetrain())) {
    await updatePredictionForNewCycle(latest.startDate);
  }
}
