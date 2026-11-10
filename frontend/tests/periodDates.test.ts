import { describe, expect, it } from 'vitest';
import {
  automaticPeriodEnds,
  periodEndFor,
  shiftDate,
  validatePeriodDates,
} from '../src/lib/periodDates';
import type { Cycle } from '../src/lib/types';

const cycle = (startDate: string, extra: Partial<Cycle> = {}): Cycle => ({ startDate, ...extra });

describe('period date helpers', () => {
  it('keeps an open five-day period through day five and closes it after the boundary', () => {
    const open = cycle('2026-10-01', { id: 1 });
    expect(automaticPeriodEnds([open], '2026-10-05')).toEqual([]);
    expect(automaticPeriodEnds([open], '2026-10-06')).toEqual([
      { ...open, endDate: '2026-10-05', periodLength: 5, autoEnded: true },
    ]);
  });

  it('does not re-close an already auto-ended period when the app is opened later', () => {
    const autoEnded = cycle('2026-10-01', {
      id: 1, endDate: '2026-10-05', periodLength: 5, autoEnded: true,
    });
    expect(automaticPeriodEnds([autoEnded], '2026-10-20')).toEqual([]);
    expect(periodEndFor(autoEnded, '2026-10-20')).toBe('2026-10-05');
  });

  it('preserves a manual end date and caps a default duration before the next start', () => {
    const manual = cycle('2026-09-01', { endDate: '2026-09-04', periodLength: 4 });
    const openBeforeNext = cycle('2026-10-01', { id: 2 });
    expect(periodEndFor(manual, '2026-10-10')).toBe('2026-09-04');
    expect(automaticPeriodEnds([
      openBeforeNext,
      cycle('2026-10-04', { id: 3, endDate: '2026-10-08', periodLength: 5 }),
    ], '2026-10-10'))
      .toEqual([{ ...openBeforeNext, endDate: '2026-10-03', periodLength: 3, autoEnded: true }]);
  });

  it('shifts date strings across month and year boundaries', () => {
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDate('2027-01-01', -1)).toBe('2026-12-31');
  });

  it('rejects malformed, impossible, future, overlapping, and non-latest open ranges', () => {
    const history = [cycle('2026-09-01', { id: 1, endDate: '2026-09-05', periodLength: 5 })];
    const today = '2026-10-10';
    expect(validatePeriodDates('2026-02-30', undefined, [], today)).toBeTruthy();
    expect(validatePeriodDates('2026-10-11', undefined, [], today)).toContain('Zukunft');
    expect(validatePeriodDates('2026-10-01', '2026-09-30', [], today)).toContain('vor dem Startdatum');
    expect(validatePeriodDates('2026-09-04', '2026-09-08', history, today)).toContain('überschneidet');
    expect(validatePeriodDates('2026-09-06', undefined, [...history, cycle('2026-09-20', { id: 2 })], today))
      .toContain('Nur die letzte Periode');
  });
});
