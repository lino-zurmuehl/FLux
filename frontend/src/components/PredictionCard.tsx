/**
 * Karte mit dem vorhergesagten nächsten Periodenstart.
 */

import { format, differenceInDays, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Calendar, TrendingUp } from 'lucide-react';
import type { Prediction } from '../lib/types';

interface Props {
  prediction: Prediction | null;
  currentCycleDay: number | null;
}

export function PredictionCard({ prediction, currentCycleDay }: Props) {
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
  const today = new Date();
  const daysUntil = differenceInDays(nextDate, today);
  const confidencePercent = Math.round(prediction.confidence * 100);

  // Statusnachricht basierend auf Tagen bis zur Periode
  let statusMessage: string;
  let statusColor: string;

  if (daysUntil < 0) {
    statusMessage = `${Math.abs(daysUntil)} Tage überfällig`;
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
    <div className="card bg-gradient-to-br from-primary-50 to-primary-100 border-primary-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6 text-primary-600" />
          <h2 className="text-lg font-semibold text-primary-900">
            Nächste Periode
          </h2>
        </div>
        {currentCycleDay && (
          <span className="text-sm bg-white px-3 py-1 rounded-full text-primary-700">
            Tag {currentCycleDay}
          </span>
        )}
      </div>

      <div className="text-center py-4">
        <div className={`text-3xl font-bold ${statusColor} mb-1`}>
          {statusMessage}
        </div>
        <div className="text-primary-700">
          {format(nextDate, 'EEEE, d. MMMM', { locale: de })}
        </div>
      </div>

      <div className="flex items-center justify-between text-sm pt-4 border-t border-primary-200">
        <div className="flex items-center gap-1 text-primary-700">
          <TrendingUp className="w-4 h-4" />
          <span>{confidencePercent}% Konfidenz</span>
        </div>
        <span className="text-primary-600">
          {prediction.expectedCycleLength}-Tage-Zyklus
        </span>
      </div>

      {prediction.fertileWindowStart && prediction.fertileWindowEnd && (
        <div className="mt-3 pt-3 border-t border-primary-200 text-sm text-primary-700">
          <span className="font-medium">Fruchtbares Fenster:</span>{' '}
          {format(parseISO(prediction.fertileWindowStart), 'd. MMM', { locale: de })} -{' '}
          {format(parseISO(prediction.fertileWindowEnd), 'd. MMM', { locale: de })}
        </div>
      )}
    </div>
  );
}
