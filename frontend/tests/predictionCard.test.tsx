import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PredictionCard } from '../src/components/PredictionCard';
import { CycleProgress } from '../src/components/CycleProgress';
import type { Prediction } from '../src/lib/types';

const prediction: Prediction = {
  nextPeriodDate: '2026-11-25',
  expectedCycleLength: 28,
  confidence: 0.8,
  fertileWindowStart: '2026-11-06',
  fertileWindowEnd: '2026-11-11',
};

function renderCard(day: number, isPeriodActive = false) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, day, 12));
  return renderToStaticMarkup(createElement(PredictionCard, { prediction, currentCycleDay: day + 3, isPeriodActive }));
}

afterEach(() => vi.useRealTimers());

describe('neutral ovulation window', () => {
  it.each([6, 7, 8, 9, 10, 11])('shows the full estimated window on November %i without an ovulation countdown', (day) => {
    const html = renderCard(day);
    expect(html).toContain('Rund um den Eisprung');
    expect(html).toContain('Aktuelles Zeitfenster');
    expect(html).toContain('6. Nov');
    expect(html).toContain('11. Nov');
    expect(html).toContain('Geschätzter Zeitraum');
    expect(html).not.toMatch(/Eisprung (heute|morgen|in)|Tag(e)? bis.*Eisprung|fruchtbar|schwanger/i);
    expect(html).not.toContain('Lutealphase');
  });

  it.each([5, 12])('does not mark the window as active outside its dates on November %i', (day) => {
    const html = renderCard(day);
    expect(html).not.toContain('Aktuelles Zeitfenster');
    expect(html).toContain('Nächste Periode');
  });

  it('prioritizes a logged ongoing period over the estimated window', () => {
    const html = renderCard(10, true);
    expect(html).toContain('Tag 13 der Periode');
    expect(html).not.toContain('Aktuelles Zeitfenster');
  });

  it('keeps the cycle ring in the ovulation phase throughout all six days', () => {
    for (let currentDay = 10; currentDay <= 15; currentDay++) {
      const html = renderToStaticMarkup(createElement(CycleProgress, { currentDay, cycleLength: 28, periodLength: 5 }));
      expect(html).toContain('Rund um den Eisprung');
      expect(html).not.toContain('Lutealphase');
      expect(html).toContain('T10');
      expect(html).toContain('15');
    }
    const after = renderToStaticMarkup(createElement(CycleProgress, { currentDay: 16, cycleLength: 28, periodLength: 5 }));
    expect(after).toContain('Lutealphase');
  });
});
