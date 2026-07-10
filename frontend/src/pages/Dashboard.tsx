/**
 * Dashboard - Hauptansicht mit Wochen-Kalender, Vorhersage und Zyklusring.
 */

import { useNavigate } from 'react-router-dom';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Upload, CalendarDays } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { MODEL_TYPE_LABELS } from '../lib/types';
import { PredictionCard } from '../components/PredictionCard';
import { CycleProgress } from '../components/CycleProgress';
import { QuickLog } from '../components/QuickLog';
import { WeekStrip } from '../components/WeekStrip';

export function Dashboard() {
  const { isLoading, hasSetup, modelParams, currentCycleDay, latestCycle } = useApp();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Laden...</div>
      </div>
    );
  }

  // Setup-Aufforderung wenn keine Daten vorhanden
  if (!hasSetup) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <div className="text-center py-12">
          <h1 className="text-3xl font-bold text-primary-700 mb-2">FLux</h1>
          <p className="text-gray-600 mb-8">
            Datenschutzfreundliche Periodentracking mit ML-Vorhersagen
          </p>

          <div className="card mb-6">
            <h2 className="text-lg font-semibold mb-2">Erste Schritte</h2>
            <p className="text-gray-600 mb-4">
              Importiere deine Daten aus der Flo-App, um mit personalisierten
              Vorhersagen zu starten.
            </p>
            <button
              onClick={() => navigate('/import')}
              className="btn btn-primary flex items-center gap-2 mx-auto"
            >
              <Upload className="w-5 h-5" />
              Daten importieren
            </button>
          </div>

          <p className="text-sm text-gray-500">
            Deine Daten bleiben auf diesem Gerät und werden verschlüsselt.
          </p>
        </div>
      </div>
    );
  }

  const prediction = modelParams?.prediction ?? null;
  const isPeriodActive = Boolean(latestCycle && !latestCycle.endDate);

  const fertileWindowDays = (() => {
    if (
      !prediction?.fertileWindowStart ||
      !prediction?.fertileWindowEnd ||
      !latestCycle?.startDate
    ) {
      return { fertileStartDay: undefined, fertileEndDay: undefined };
    }
    const cycleStart = parseISO(latestCycle.startDate);
    return {
      fertileStartDay:
        differenceInCalendarDays(parseISO(prediction.fertileWindowStart), cycleStart) + 1,
      fertileEndDay:
        differenceInCalendarDays(parseISO(prediction.fertileWindowEnd), cycleStart) + 1,
    };
  })();

  return (
    <div className="p-4 max-w-lg mx-auto pb-8">
      {/* Kopfzeile */}
      <header className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-extrabold text-primary-800 tracking-tight">FLux</h1>
        <span className="text-base font-semibold text-gray-800 capitalize">
          {format(new Date(), 'MMMM yyyy', { locale: de })}
        </span>
        <button
          onClick={() => navigate('/calendar')}
          className="p-2 rounded-full hover:bg-sky-100 text-primary-700"
          title="Kalender öffnen"
        >
          <CalendarDays className="w-5 h-5" />
        </button>
      </header>

      {/* Wochen-Kalender */}
      <WeekStrip latestCycle={latestCycle} prediction={prediction} />

      {/* Vorhersage-Karte */}
      <PredictionCard
        prediction={prediction}
        currentCycleDay={currentCycleDay}
        isPeriodActive={isPeriodActive}
      />

      {/* Zyklus-Fortschritt */}
      {prediction && currentCycleDay && (
        <CycleProgress
          currentDay={currentCycleDay}
          cycleLength={prediction.expectedCycleLength}
          periodLength={prediction.periodLength ?? 5}
          fertileStart={fertileWindowDays.fertileStartDay}
          fertileEnd={fertileWindowDays.fertileEndDay}
        />
      )}

      {/* Schnellaktionen */}
      <QuickLog />

      {/* Statistiken */}
      {modelParams && (
        <div className="card mt-4">
          <h3 className="font-semibold text-gray-800 mb-3">Zyklus-Statistiken</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                label: 'Durchschnittlicher Zyklus',
                value: `${Math.round(modelParams.avgCycleLength)} Tage`,
              },
              { label: 'Erfasste Zyklen', value: `${modelParams.cyclesTrained}` },
              {
                label: 'Abweichung',
                value: `±${modelParams.stdCycleLength.toFixed(1)} Tage`,
              },
              {
                label: 'Modell',
                value: MODEL_TYPE_LABELS[modelParams.modelType] ?? modelParams.modelType,
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl bg-sky-50/70 border border-sky-100 p-3"
              >
                <div className="text-xs text-gray-500">{stat.label}</div>
                <div className="font-bold text-gray-800 capitalize mt-0.5">
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
