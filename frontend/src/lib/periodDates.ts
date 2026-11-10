import { addDays, differenceInCalendarDays, format, isValid, parseISO } from 'date-fns';
import type { Cycle } from './types';

export const DEFAULT_PERIOD_DAYS = 5;

export function isValidDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && isValid(parseISO(date));
}

export function shiftDate(date: string, days: number): string {
  return format(addDays(parseISO(date), days), 'yyyy-MM-dd');
}

/** Open periods are displayed only through today, with a five-day default. */
export function periodEndFor(cycle: Cycle, today: string): string {
  if (!isValidDate(cycle.startDate)) return cycle.startDate;
  return cycle.endDate ?? [today, shiftDate(cycle.startDate, (cycle.periodLength ?? DEFAULT_PERIOD_DAYS) - 1)].sort()[0];
}

/** Close after all five calendar days have passed; never overlap the next cycle. */
export function automaticPeriodEnds(cycles: Cycle[], today: string): Cycle[] {
  const sorted = [...cycles].sort((a, b) => a.startDate.localeCompare(b.startDate));
  return sorted.flatMap((cycle, index) => {
    if (cycle.endDate || !isValidDate(cycle.startDate)) return [];
    const duration = cycle.periodLength && Number.isFinite(cycle.periodLength) && cycle.periodLength > 0 ? cycle.periodLength : DEFAULT_PERIOD_DAYS;
    let end = shiftDate(cycle.startDate, duration - 1);
    const next = sorted[index + 1];
    if (next && next.startDate <= end) end = shiftDate(next.startDate, -1);
    if (end < cycle.startDate || today <= end) return [];
    return [{ ...cycle, endDate: end, periodLength: differenceInCalendarDays(parseISO(end), parseISO(cycle.startDate)) + 1, autoEnded: true }];
  });
}

export function validatePeriodDates(
  start: string,
  end: string | undefined,
  cycles: Cycle[],
  today: string,
  id?: number
): string | undefined {
  if (!isValidDate(start) || (end !== undefined && !isValidDate(end))) return 'Bitte wähle ein gültiges Datum.';
  if (start > today || (end && end > today)) return 'Perioden können nicht in der Zukunft erfasst werden.';
  if (end && end < start) return 'Das Enddatum kann nicht vor dem Startdatum liegen.';
  if (id !== undefined && !cycles.some((cycle) => cycle.id === id)) return 'Die Periode wurde nicht gefunden. Bitte lade den Kalender neu.';
  const rangeEnd = end ?? periodEndFor({ startDate: start }, today);
  for (const cycle of cycles) {
    if (id !== undefined && cycle.id === id) continue;
    if (start <= periodEndFor(cycle, today) && rangeEnd >= cycle.startDate) return 'Der Zeitraum überschneidet sich mit einer anderen Periode.';
    if (!end && cycle.startDate > start) return 'Nur die letzte Periode kann noch laufen. Wähle ein Enddatum.';
  }
  return undefined;
}
