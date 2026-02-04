/**
 * Dashboard - Hauptansicht mit Vorhersage und Zyklusinfo.
 */

import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { PredictionCard } from '../components/PredictionCard';
import { CycleProgress } from '../components/CycleProgress';
import { QuickLog } from '../components/QuickLog';
import { Upload } from 'lucide-react';

export function Dashboard() {
  const { isLoading, hasSetup, modelParams, currentCycleDay } = useApp();
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

  return (
    <div className="p-4 max-w-lg mx-auto">
      {/* Header */}
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-primary-800">FLux</h1>
        <p className="text-sm text-gray-500">Dein Zyklus auf einen Blick</p>
      </header>

      {/* Vorhersage-Karte */}
      <PredictionCard
        prediction={modelParams?.prediction ?? null}
        currentCycleDay={currentCycleDay}
      />

      {/* Zyklus-Fortschritt */}
      {modelParams?.prediction && currentCycleDay && (
        <CycleProgress
          currentDay={currentCycleDay}
          cycleLength={modelParams.prediction.expectedCycleLength}
          periodLength={modelParams.prediction.periodLength ?? 5}
        />
      )}

      {/* Schnell-Eintrag */}
      <QuickLog />

      {/* Statistiken */}
      {modelParams && (
        <div className="card mt-4">
          <h3 className="font-medium text-gray-700 mb-3">Zyklus-Statistiken</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-500">Durchschnittlicher Zyklus</div>
              <div className="font-semibold">
                {Math.round(modelParams.avgCycleLength)} Tage
              </div>
            </div>
            <div>
              <div className="text-gray-500">Erfasste Zyklen</div>
              <div className="font-semibold">{modelParams.cyclesTrained}</div>
            </div>
            <div>
              <div className="text-gray-500">Abweichung</div>
              <div className="font-semibold">
                ±{modelParams.stdCycleLength.toFixed(1)} Tage
              </div>
            </div>
            <div>
              <div className="text-gray-500">Modell</div>
              <div className="font-semibold capitalize">
                {modelParams.modelType.replace('_', ' ')}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
