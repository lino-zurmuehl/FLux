/**
 * Horizontaler Wochen-Kalender im Flo-Stil.
 * Zeigt 7 Tage um heute herum mit Perioden-, Vorhersage- und Fruchtbarkeitsmarkierungen.
 */

import { addDays, format, isSameDay, parseISO, subDays } from 'date-fns';
import { de } from 'date-fns/locale';
import type { Cycle, Prediction } from '../lib/types';

interface Props {
  latestCycle: Cycle | null;
  prediction: Prediction | null;
}

type DayKind = 'period' | 'predicted' | 'fertile' | 'plain';

function classifyDay(
  date: Date,
  today: Date,
  latestCycle: Cycle | null,
  prediction: Prediction | null
): DayKind {
  const iso = format(date, 'yyyy-MM-dd');
  const todayIso = format(today, 'yyyy-MM-dd');

  // Tatsächliche Periode (laufende Periode reicht bis heute)
  if (latestCycle) {
    const start = latestCycle.startDate;
    const end = latestCycle.endDate ?? todayIso;
    if (iso >= start && iso <= end) {
      return 'period';
    }
  }

  // Vorhergesagte Periode (Vergleich über ISO-Strings, um Uhrzeiten zu ignorieren)
  if (prediction?.nextPeriodDate) {
    const predStartIso = prediction.nextPeriodDate;
    const predEndIso = format(
      addDays(parseISO(prediction.nextPeriodDate), Math.max(1, prediction.periodLength ?? 5) - 1),
      'yyyy-MM-dd'
    );
    if (iso >= predStartIso && iso <= predEndIso) {
      return 'predicted';
    }
  }

  // Fruchtbares Fenster
  if (prediction?.fertileWindowStart && prediction?.fertileWindowEnd) {
    const fs = prediction.fertileWindowStart;
    const fe = prediction.fertileWindowEnd;
    if (iso >= fs && iso <= fe) {
      return 'fertile';
    }
  }

  return 'plain';
}

const DAY_STYLES: Record<DayKind, { idle: string; today: string }> = {
  period: {
    idle: 'bg-gradient-to-b from-primary-400 to-primary-600 text-white shadow-sm',
    today: 'bg-gradient-to-b from-primary-400 to-primary-600 text-white shadow-md ring-2 ring-primary-700 ring-offset-2 ring-offset-sky-50',
  },
  predicted: {
    idle: 'border-2 border-dashed border-primary-300 text-primary-600 bg-primary-50/60',
    today: 'border-2 border-dashed border-primary-400 text-primary-700 bg-primary-50 ring-2 ring-primary-400 ring-offset-2 ring-offset-sky-50',
  },
  fertile: {
    idle: 'border-2 border-sky-300 text-sky-700 bg-sky-50',
    today: 'border-2 border-sky-400 text-sky-800 bg-sky-100 ring-2 ring-sky-400 ring-offset-2 ring-offset-sky-50',
  },
  plain: {
    idle: 'text-gray-600 bg-white/70 border border-sky-100',
    today: 'text-primary-800 bg-white shadow-md ring-2 ring-primary-600 ring-offset-2 ring-offset-sky-50 font-bold',
  },
};

export function WeekStrip({ latestCycle, prediction }: Props) {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => addDays(subDays(today, 3), i));

  return (
    <div className="flex justify-between items-start gap-1 px-1 mb-6">
      {days.map((date) => {
        const kind = classifyDay(date, today, latestCycle, prediction);
        const isToday = isSameDay(date, today);
        const style = isToday ? DAY_STYLES[kind].today : DAY_STYLES[kind].idle;

        return (
          <div key={date.toISOString()} className="flex flex-col items-center gap-1.5 flex-1">
            <span
              className={`text-[11px] uppercase tracking-wide ${
                isToday ? 'text-primary-700 font-bold' : 'text-gray-400 font-medium'
              }`}
            >
              {format(date, 'EEEEEE', { locale: de })}
            </span>
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${style}`}
            >
              {format(date, 'd')}
            </div>
            <span className="h-3 text-[10px] font-semibold text-primary-700">
              {isToday ? 'Heute' : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}
