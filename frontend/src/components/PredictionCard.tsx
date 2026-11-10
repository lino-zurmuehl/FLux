/**
 * Hero-Karte der Startseite: Zyklusring plus eine Kernaussage pro Phase
 * (nächste Periode, laufende Periode oder Zeitfenster rund um den Eisprung).
 */

import { addDays, format, differenceInCalendarDays, parseISO, subDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { Calendar } from 'lucide-react';
import type { Prediction } from '../lib/types';
import { CycleProgress } from './CycleProgress';

interface Props {
  prediction: Prediction | null;
  currentCycleDay: number | null;
  isPeriodActive?: boolean;
  /** Übliche Schwankung in Tagen (aus der Streuung der Zykluslängen). */
  uncertaintyDays?: number;
}

export function PredictionCard({
  prediction,
  currentCycleDay,
  isPeriodActive = false,
  uncertaintyDays,
}: Props) {
  const normalizeToNoon = (date: Date) => {
    date.setHours(12, 0, 0, 0);
    return date;
  };

  if (!prediction) {
    return (
      <div className="card bg-gradient-to-br from-primary-50 to-primary-100 border-primary-200">
        <div className="flex items-center gap-3 mb-2">
          <Calendar className="w-6 h-6 text-primary-600" />
          <h2 className="text-lg font-semibold text-primary-900">
            Nächste Periode
          </h2>
        </div>
        <p className="text-primary-700">
          Importiere deine Daten und das Modell, um Vorhersagen zu sehen.
        </p>
      </div>
    );
  }

  const nextDate = parseISO(prediction.nextPeriodDate);
  const today = normalizeToNoon(new Date());
  normalizeToNoon(nextDate);
  const daysUntil = differenceInCalendarDays(nextDate, today);

  const fertileStartDate = prediction.fertileWindowStart
    ? normalizeToNoon(parseISO(prediction.fertileWindowStart))
    : null;
  const fertileEndDate = prediction.fertileWindowEnd
    ? normalizeToNoon(parseISO(prediction.fertileWindowEnd))
    : null;

  const isFertilePhase = !isPeriodActive
    && fertileStartDate !== null
    && fertileEndDate !== null
    && today >= fertileStartDate
    && today <= fertileEndDate;

  let statusMessage: string;
  let statusColor = 'text-primary-800';
  let cardBackgroundClass = 'bg-gradient-to-b from-primary-50 to-primary-100 border-primary-200';
  let detailToneClass = 'text-primary-800';

  if (isPeriodActive && currentCycleDay !== null) {
    statusMessage = `Tag ${currentCycleDay} der Periode`;
    cardBackgroundClass = 'bg-gradient-to-b from-primary-100 to-primary-200 border-primary-300';
  } else if (isFertilePhase) {
    statusMessage = 'Rund um den Eisprung';
    statusColor = 'text-sky-700';
    cardBackgroundClass = 'bg-gradient-to-b from-sky-50 to-sky-100 border-sky-300';
    detailToneClass = 'text-sky-800';
  } else if (daysUntil < 0) {
    const overdueDays = Math.abs(daysUntil);
    statusMessage = `${overdueDays} ${overdueDays === 1 ? 'Tag' : 'Tage'} überfällig`;
    statusColor = 'text-red-600';
  } else if (daysUntil === 0) {
    statusMessage = 'Heute erwartet';
  } else if (daysUntil === 1) {
    statusMessage = 'Morgen erwartet';
  } else {
    statusMessage = `In ${daysUntil} Tagen`;
  }

  // Ring: Fenster-Tage relativ zum Start des laufenden Zyklus.
  const cycleStart = currentCycleDay ? subDays(today, currentCycleDay - 1) : null;
  const toCycleDay = (date: Date | null) =>
    cycleStart && date ? differenceInCalendarDays(date, cycleStart) + 1 : undefined;
  const basePeriodLength = prediction.periodLength ?? 5;

  const shortDate = (date: Date) => format(date, 'd. MMM', { locale: de });
  const spread = uncertaintyDays && uncertaintyDays > 0 ? Math.round(uncertaintyDays) : 0;
  const rangeText = spread > 0
    ? `Meist zwischen ${shortDate(subDays(nextDate, spread))} und ${shortDate(addDays(nextDate, spread))}`
    : null;

  return (
    <div className={`card px-5 pt-4 pb-5 ${cardBackgroundClass}`}>
      <h2 className={`text-xs font-semibold uppercase tracking-wider text-center mb-3 ${detailToneClass} opacity-80`}>
        {isFertilePhase ? 'Deine Zyklusphase' : isPeriodActive ? 'Deine Periode' : 'Nächste Periode'}
      </h2>

      {currentCycleDay && (
        <CycleProgress
          currentDay={currentCycleDay}
          cycleLength={prediction.expectedCycleLength}
          periodLength={isPeriodActive ? Math.max(basePeriodLength, currentCycleDay) : basePeriodLength}
          fertileStart={toCycleDay(fertileStartDate)}
          fertileEnd={toCycleDay(fertileEndDate)}
          hideLegend
        />
      )}

      <div className="text-center mt-4">
        {isFertilePhase && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-sky-700 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500" /> Aktuelles Zeitfenster
          </span>
        )}
        <div className={`${isFertilePhase ? 'text-2xl' : 'text-3xl'} font-bold tracking-tight ${statusColor}`}>
          {statusMessage}
        </div>
        <div className={`mt-1 ${detailToneClass}`}>
          {isFertilePhase && fertileStartDate && fertileEndDate
            ? `${shortDate(fertileStartDate)} – ${shortDate(fertileEndDate)}`
            : isPeriodActive
              ? `Nächste Periode: ${shortDate(nextDate)}`
              : format(nextDate, 'EEEE, d. MMMM', { locale: de })}
        </div>
        {isFertilePhase ? (
          <>
            <p className="text-xs text-sky-700 mt-2">Geschätzter Zeitraum · der genaue Zeitpunkt kann variieren.</p>
            <p className={`text-sm mt-3 ${detailToneClass}`}>
              <span className="font-medium">Nächste Periode:</span> {shortDate(nextDate)}
            </p>
          </>
        ) : (
          !isPeriodActive && rangeText && daysUntil >= 0 && (
            <p className={`text-xs mt-1.5 ${detailToneClass} opacity-80`}>{rangeText}</p>
          )
        )}
      </div>

      {currentCycleDay && (
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-4 text-[11px] text-gray-600">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-primary-500 rounded-full" />
            Periode
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-sky-300 rounded-full" />
            Rund um den Eisprung
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-white" style={{ border: '2px solid #4c0d1c' }} />
            Heute
          </span>
        </div>
      )}
    </div>
  );
}
