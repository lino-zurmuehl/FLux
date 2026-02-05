/**
 * Einstellungen - Daten exportieren, löschen, App-Info.
 */

import { useState } from 'react';
import { Download, Trash2, Shield, Info, ExternalLink, LogOut } from 'lucide-react';
import { exportData, deleteAllData } from '../lib/db';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';

export function Settings() {
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { refreshData, modelParams } = useApp();
  const { logout } = useAuth();

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const data = await exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `flux-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export fehlgeschlagen:', error);
      alert('Export fehlgeschlagen. Bitte versuche es erneut.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteAllData();
      await refreshData();
      setShowDeleteConfirm(false);
      alert('Alle Daten wurden gelöscht.');
    } catch (error) {
      console.error('Löschen fehlgeschlagen:', error);
      alert('Löschen fehlgeschlagen. Bitte versuche es erneut.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-4 max-w-lg mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-primary-800">Einstellungen</h1>
        <p className="text-sm text-gray-500">Verwalte deine Daten und Privatsphäre</p>
      </header>

      {/* App sperren */}
      <div className="card mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LogOut className="w-6 h-6 text-gray-600" />
            <div>
              <h3 className="font-medium">App sperren</h3>
              <p className="text-sm text-gray-500">Sperrt die App bis zur erneuten PIN-Eingabe</p>
            </div>
          </div>
          <button onClick={logout} className="btn btn-secondary">
            Sperren
          </button>
        </div>
      </div>

      {/* Datenschutz-Info */}
      <div className="card mb-4 bg-sky-50 border-sky-200">
        <div className="flex items-start gap-3">
          <Shield className="w-6 h-6 text-primary-600 flex-shrink-0" />
          <div>
            <h3 className="font-medium text-primary-900">Deine Privatsphäre</h3>
            <p className="text-sm text-primary-700 mt-1">
              Alle deine Daten werden lokal auf diesem Gerät gespeichert. Es wird
              nichts an einen Server gesendet. Deine Zyklusdaten verlassen niemals
              dein Gerät.
            </p>
          </div>
        </div>
      </div>

      {/* Daten exportieren */}
      <div className="card mb-4">
        <div className="flex items-start gap-3">
          <Download className="w-6 h-6 text-gray-600 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-medium">Daten exportieren</h3>
            <p className="text-sm text-gray-500 mt-1">
              Lade alle Zyklus- und Eintragsdaten als JSON herunter. Verwende dies um:
            </p>
            <ul className="text-sm text-gray-500 mt-2 list-disc list-inside">
              <li>Deine Daten zu sichern</li>
              <li>Das Vorhersagemodell neu zu trainieren</li>
              <li>Auf ein anderes Gerät zu übertragen</li>
            </ul>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="btn btn-secondary mt-4"
            >
              {isExporting ? 'Exportiere...' : 'Daten exportieren'}
            </button>
          </div>
        </div>
      </div>

      {/* Modell-Info */}
      {modelParams && (
        <div className="card mb-4">
          <div className="flex items-start gap-3">
            <Info className="w-6 h-6 text-gray-600 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-medium">Modell-Info</h3>
              <div className="text-sm text-gray-500 mt-2 space-y-1">
                <div className="flex justify-between">
                  <span>Modelltyp:</span>
                  <span className="font-medium capitalize">
                    {modelParams.modelType.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Trainierte Zyklen:</span>
                  <span className="font-medium">{modelParams.cyclesTrained}</span>
                </div>
                <div className="flex justify-between">
                  <span>Zuletzt trainiert:</span>
                  <span className="font-medium">
                    {new Date(modelParams.trainedAt).toLocaleDateString('de-DE')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Konfidenz:</span>
                  <span className="font-medium">
                    {Math.round(modelParams.prediction.confidence * 100)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trainings-Anleitung */}
      <div className="card mb-4 bg-sky-50">
        <h3 className="font-medium mb-2">Modell neu trainieren</h3>
        <p className="text-sm text-gray-600 mb-3">
          Nach jeder Periode kannst du das Modell für bessere Vorhersagen neu trainieren:
        </p>
        <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
          <li>Exportiere deine Daten (oben)</li>
          <li>
            Führe auf deinem Mac aus:
            <code className="block bg-sky-200 px-2 py-1 rounded mt-1 text-xs overflow-x-auto">
              python -m ml train -i exported_data.json -o model_params.json
            </code>
          </li>
          <li>Importiere die neue model_params.json im Import-Tab</li>
        </ol>
      </div>

      {/* Daten löschen */}
      <div className="card border-red-200">
        <div className="flex items-start gap-3">
          <Trash2 className="w-6 h-6 text-red-600 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-medium text-red-900">Alle Daten löschen</h3>
            <p className="text-sm text-red-700 mt-1">
              Lösche dauerhaft alle Zyklen, Einträge und Einstellungen. Dies kann
              nicht rückgängig gemacht werden.
            </p>
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="btn btn-danger mt-4"
              >
                Alle Daten löschen
              </button>
            ) : (
              <div className="mt-4 p-4 bg-red-50 rounded-lg">
                <p className="text-sm font-medium text-red-800 mb-3">
                  Bist du sicher? Dies löscht alles unwiderruflich.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="btn btn-danger flex-1"
                  >
                    {isDeleting ? 'Lösche...' : 'Ja, löschen'}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="btn btn-secondary flex-1"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Über */}
      <div className="mt-8 text-center text-sm text-gray-500">
        <p className="font-medium text-gray-700">FLux v0.1.0</p>
        <p className="mt-1">Datenschutzfreundliches Periodentracking</p>
        <p className="mt-2">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary-600 hover:underline"
          >
            Auf GitHub ansehen
            <ExternalLink className="w-3 h-3" />
          </a>
        </p>
      </div>
    </div>
  );
}
