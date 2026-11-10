/**
 * Dashboard - Hauptansicht mit Wochen-Kalender, Vorhersage-Karte (inkl. Zyklusring) und Heute-Aktionen.
 */

import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Upload, CalendarDays } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { PredictionCard } from '../components/PredictionCard';
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
            Datenschutzfreundliches Periodentracking mit ML-Vorhersagen
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

          <QuickLog />
          <p className="text-sm text-gray-500 mt-4">
            Deine Daten bleiben auf diesem Gerät und werden verschlüsselt.
          </p>
        </div>
      </div>
    );
  }

  const prediction = modelParams?.prediction ?? null;
  const isPeriodActive = Boolean(latestCycle && !latestCycle.endDate);

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
          aria-label="Kalender öffnen"
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
        uncertaintyDays={modelParams ? Math.max(1, Math.round(modelParams.stdCycleLength)) : undefined}
      />

      <QuickLog />

      {/* Statistiken */}
      {modelParams && (
        <div className="grid grid-cols-3 gap-2 mt-4">
          {[
            { label: 'Ø Zyklus', value: `${Math.round(modelParams.avgCycleLength)} Tage` },
            { label: 'Schwankung', value: `±${modelParams.stdCycleLength.toFixed(1)} Tage` },
            { label: 'Zyklen erfasst', value: `${modelParams.cyclesTrained}` },
          ].map((stat) => (
            <button
              key={stat.label}
              onClick={() => navigate('/history')}
              className="rounded-2xl bg-white border border-sky-100 shadow-sm px-3 py-3 text-left hover:border-sky-200"
            >
              <div className="text-[11px] text-gray-500">{stat.label}</div>
              <div className="font-bold text-gray-800 mt-0.5 tabular-nums">{stat.value}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
