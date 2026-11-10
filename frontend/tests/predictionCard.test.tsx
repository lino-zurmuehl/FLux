import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PredictionCard } from '../src/components/PredictionCard';
import { CycleProgress } from '../src/components/CycleProgress';
import { fertileWindowFor } from '../src/lib/ovulation';
import type { Prediction } from '../src/lib/types';

// Next period Nov 25 -> ovulation Nov 11, fertile phase Nov 6 - Nov 12.
const prediction: Prediction = {
  nextPeriodDate: '2026-11-25',
  expectedCycleLength: 28,
  confidence: 0.8,
  fertileWindowStart: '2026-11-06',
  fertileWindowEnd: '2026-11-12',
};

function renderCard(day: number, isPeriodActive = false) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, day, 12));
  return renderToStaticMarkup(createElement(PredictionCard, { prediction, currentCycleDay: day + 3, isPeriodActive }));
}

afterEach(() => vi.useRealTimers());

describe('fertile phase and ovulation countdown', () => {
  it('spans five days before ovulation through one day after', () => {
    expect(fertileWindowFor('2026-11-25')).toEqual({
      start: '2026-11-06',
      ovulation: '2026-11-11',
      end: '2026-11-12',
    });
  });

  it.each([
    [6, '5 Tage bis zum Eisprung'],
    [7, '4 Tage bis zum Eisprung'],
    [8, '3 Tage bis zum Eisprung'],
    [9, '2 Tage bis zum Eisprung'],
    [10, '1 Tag bis zum Eisprung'],
    [11, 'Eisprung heute'],
    [12, '1 Tag nach dem Eisprung'],
  ])('on November %i shows "%s"', (day, message) => {
    const html = renderCard(day);
    expect(html).toContain(message);
    expect(html).toContain('6. Nov. – 12. Nov.');
    expect(html).toContain('Geschätzt');
    expect(html).not.toMatch(/schwanger/i);
    expect(html).not.toContain('Lutealphase');
  });

  it.each([5, 13])('does not show a countdown outside the phase on November %i', (day) => {
    const html = renderCard(day);
    expect(html).not.toMatch(/bis zum Eisprung|nach dem Eisprung|Eisprung heute/);
    expect(html).toContain('Nächste Periode');
  });

  it('derives the phase from the predicted period start, not from stored window dates', () => {
    const stale = { ...prediction, fertileWindowEnd: '2026-11-11' };
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 12, 12));
    const html = renderToStaticMarkup(createElement(PredictionCard, { prediction: stale, currentCycleDay: 15 }));
    expect(html).toContain('1 Tag nach dem Eisprung');
  });

  it('prioritizes a logged ongoing period over the fertile phase', () => {
    const html = renderCard(10, true);
    expect(html).toContain('Tag 13 der Periode');
    expect(html).not.toContain('bis zum Eisprung');
  });

  it('keeps the cycle ring in the fertile phase for all seven days', () => {
    for (let currentDay = 10; currentDay <= 16; currentDay++) {
      const html = renderToStaticMarkup(createElement(CycleProgress, { currentDay, cycleLength: 28, periodLength: 5 }));
      expect(html).toContain('Fruchtbare Phase (T10–16)');
      expect(html).not.toContain('Lutealphase');
    }
    const after = renderToStaticMarkup(createElement(CycleProgress, { currentDay: 17, cycleLength: 28, periodLength: 5 }));
    expect(after).toContain('Lutealphase');
  });
});
