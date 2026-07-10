/**
 * Karte mit dem vorhergesagten nächsten Periodenstart.
 */

import { format, differenceInCalendarDays, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Calendar, TrendingUp } from 'lucide-react';
import type { Prediction } from '../lib/types';

interface Props {
  prediction: Prediction | null;
  currentCycleDay: number | null;
  isPeriodActive?: boolean;
}

export function PredictionCard({ prediction, currentCycleDay, isPeriodActive = false }: Props) {
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
  const confidencePercent = Math.round(prediction.confidence * 100);

  const fertileStartDate = prediction.fertileWindowStart
    ? normalizeToNoon(parseISO(prediction.fertileWindowStart))
    : null;
  const fertileEndDate = prediction.fertileWindowEnd
    ? normalizeToNoon(parseISO(prediction.fertileWindowEnd))
    : null;

  // The ML pipeline defines the fertile window as ovulation-5 ... ovulation,
  // so ovulation is the END of the window (not its midpoint).
  const ovulationDate = fertileEndDate ? new Date(fertileEndDate) : null;

  const isFertilePhase = fertileStartDate !== null
    && fertileEndDate !== null
    && today >= fertileStartDate
    && today <= fertileEndDate;

  const isOvulationPhase = ovulationDate !== null
    && differenceInCalendarDays(today, ovulationDate) >= 0
    && differenceInCalendarDays(today, ovulationDate) <= 2;

  const postPeriodBeforeOvulation = !isPeriodActive
    && ovulationDate !== null
    && currentCycleDay !== null
    && currentCycleDay > (prediction.periodLength ?? 5)
    && today < ovulationDate;

  let statusMessage: string;
  let statusColor: string;
  let cardBackgroundClass = 'bg-gradient-to-br from-primary-50 to-primary-100 border-primary-200';
  let headerAccentClass = 'text-primary-600';
  let dayBadgeClass = 'text-sm bg-white px-3 py-1 rounded-full text-primary-700';
  let detailToneClass = 'text-primary-700';
  let detailBorderClass = 'border-primary-200';

  if (isPeriodActive && currentCycleDay !== null) {
    statusMessage = `Tag ${currentCycleDay} der Periode`;
    statusColor = 'text-primary-700';
    cardBackgroundClass = 'bg-gradient-to-br from-primary-200 via-primary-100 to-rose-100 border-primary-300';
  } else if (postPeriodBeforeOvulation && ovulationDate) {
    const daysUntilOvulation = differenceInCalendarDays(ovulationDate, today);
    if (daysUntilOvulation === 0) {
      statusMessage = 'Eisprung heute';
    } else if (daysUntilOvulation === 1) {
      statusMessage = 'Eisprung morgen';
    } else {
      statusMessage = `Noch ${daysUntilOvulation} Tage bis Eisprung`;
    }
    statusColor = 'text-sky-600';
    cardBackgroundClass = 'bg-gradient-to-br from-sky-100 via-sky-50 to-cyan-100 border-sky-300';
    headerAccentClass = 'text-sky-600';
    dayBadgeClass = 'text-sm bg-white px-3 py-1 rounded-full text-sky-700';
    detailToneClass = 'text-sky-800';
    detailBorderClass = 'border-sky-300';
  } else if (isOvulationPhase && fertileEndDate && ovulationDate) {
    const daysSinceOvulation = differenceInCalendarDays(today, ovulationDate);
    const daysUntilFertileEnd = Math.max(0, differenceInCalendarDays(fertileEndDate, today));
    if (daysSinceOvulation === 0) {
      statusMessage = 'Eisprung heute';
    } else {
      statusMessage = `Eisprung +${daysSinceOvulation} • Fruchtbar noch ${daysUntilFertileEnd} Tage`;
    }
    statusColor = 'text-sky-600';
    cardBackgroundClass = 'bg-gradient-to-br from-sky-100 via-sky-50 to-cyan-100 border-sky-300';
    headerAccentClass = 'text-sky-600';
    dayBadgeClass = 'text-sm bg-white px-3 py-1 rounded-full text-sky-700';
    detailToneClass = 'text-sky-800';
    detailBorderClass = 'border-sky-300';
  } else if (isFertilePhase && fertileEndDate) {
    const daysUntilFertileEnd = Math.max(0, differenceInCalendarDays(fertileEndDate, today));
    statusMessage = daysUntilFertileEnd === 0
      ? 'Letzter fruchtbarer Tag'
      : `Fruchtbar • noch ${daysUntilFertileEnd} Tage`;
    statusColor = 'text-sky-600';
    cardBackgroundClass = 'bg-gradient-to-br from-sky-100 via-sky-50 to-cyan-100 border-sky-300';
    headerAccentClass = 'text-sky-600';
    dayBadgeClass = 'text-sm bg-white px-3 py-1 rounded-full text-sky-700';
    detailToneClass = 'text-sky-800';
    detailBorderClass = 'border-sky-300';
  } else if (daysUntil < 0) {
    const overdueDays = Math.abs(daysUntil);
    statusMessage = `${overdueDays} ${overdueDays === 1 ? 'Tag' : 'Tage'} überfällig`;
    statusColor = 'text-red-600';
  } else if (daysUntil === 0) {
    statusMessage = 'Heute erwartet';
    statusColor = 'text-primary-700';
  } else if (daysUntil === 1) {
    statusMessage = 'Morgen erwartet';
    statusColor = 'text-primary-600';
  } else if (daysUntil <= 3) {
    statusMessage = `In ${daysUntil} Tagen`;
    statusColor = 'text-primary-600';
  } else {
    statusMessage = `In ${daysUntil} Tagen`;
    statusColor = 'text-primary-700';
  }

  return (
    <div className={`card ${cardBackgroundClass}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Calendar className={`w-6 h-6 ${headerAccentClass}`} />
          <h2 className="text-lg font-semibold text-primary-900">
            Nächste Periode
          </h2>
        </div>
        {currentCycleDay && (
          <span className={dayBadgeClass}>
            Tag {currentCycleDay}
          </span>
        )}
      </div>

      <div className="text-center py-4">
        <div className={`text-3xl font-bold ${statusColor} mb-1`}>
          {statusMessage}
        </div>
        <div className={detailToneClass}>
          <span className="font-medium">Nächste Periode:</span>{' '}
          {format(nextDate, 'EEEE, d. MMMM', { locale: de })}
        </div>
      </div>

      <div className={`flex items-center justify-between text-sm pt-4 border-t ${detailBorderClass}`}>
        <div className={`flex items-center gap-1 ${detailToneClass}`}>
          <TrendingUp className="w-4 h-4" />
          <span>{confidencePercent}% Konfidenz</span>
        </div>
        <span className={detailToneClass}>
          {prediction.expectedCycleLength}-Tage-Zyklus
        </span>
      </div>

      {prediction.fertileWindowStart && prediction.fertileWindowEnd && (
        <div className={`mt-3 pt-3 border-t text-sm ${detailToneClass} ${detailBorderClass}`}>
          <span className="font-medium">Fruchtbares Fenster:</span>{' '}
          {format(parseISO(prediction.fertileWindowStart), 'd. MMM', { locale: de })} -{' '}
          {format(parseISO(prediction.fertileWindowEnd), 'd. MMM', { locale: de })}
          {ovulationDate && (
            <>
              {' '}• <span className="font-medium">Eisprung:</span>{' '}
              {format(ovulationDate, 'd. MMM', { locale: de })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
