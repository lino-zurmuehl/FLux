/**
 * Geschätzter Eisprung und fruchtbare Phase.
 * Eine Definition für die ganze App (und die Python-Pipeline):
 * Eisprung = nächster Periodenstart − 14 Tage,
 * fruchtbare Phase = 5 Tage davor bis 1 Tag danach (7 Tage).
 */
import { addDays, format, parseISO, subDays } from 'date-fns';
import type { Prediction } from './types';

export const DAYS_FROM_OVULATION_TO_PERIOD = 14;
export const FERTILE_DAYS_BEFORE_OVULATION = 5;
export const FERTILE_DAYS_AFTER_OVULATION = 1;

export interface FertileWindow {
  /** ISO-Datum (yyyy-MM-dd) */
  start: string;
  ovulation: string;
  end: string;
}

const iso = (date: Date) => format(date, 'yyyy-MM-dd');

/** Leitet das Fenster aus dem vorhergesagten Periodenstart ab. */
export function fertileWindowFor(nextPeriodDate: string): FertileWindow {
  const ovulation = subDays(parseISO(nextPeriodDate), DAYS_FROM_OVULATION_TO_PERIOD);
  return {
    start: iso(subDays(ovulation, FERTILE_DAYS_BEFORE_OVULATION)),
    ovulation: iso(ovulation),
    end: iso(addDays(ovulation, FERTILE_DAYS_AFTER_OVULATION)),
  };
}

export function fertileWindowOf(prediction: Prediction | null | undefined): FertileWindow | null {
  return prediction?.nextPeriodDate ? fertileWindowFor(prediction.nextPeriodDate) : null;
}
