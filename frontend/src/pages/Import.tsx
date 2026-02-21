/**
 * Import - Daten und Modellparameter importieren.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileJson, Check, AlertCircle } from 'lucide-react';
import { importCycles, importLogs, saveModelParams } from '../lib/db';
import { useApp } from '../contexts/AppContext';
import type { Cycle, DailyLog, FlowIntensity, ModelParams } from '../lib/types';

type ImportType = 'flo' | 'model' | 'backup';

interface ParsedFloData {
  cycles: Cycle[];
  logs: DailyLog[];
}

const FLO_FLOW_MAP: Record<number, FlowIntensity> = {
  0: 'spotting',
  1: 'light',
  2: 'medium',
  3: 'heavy',
};

// Konvertiert snake_case zu camelCase (Python -> JS Kompatibilität)
function snakeToCamel(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[camelKey] = snakeToCamel(value as Record<string, unknown>);
    } else {
      result[camelKey] = value;
    }
  }
  return result;
}

export function Import() {
  const [importType, setImportType] = useState<ImportType>('model');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const { refreshData } = useApp();
  const navigate = useNavigate();

  // Parse verschiedene Datumsformate (Flo GDPR: "2018-10-22 00:00:00.0")
  const parseDate = (dateVal: unknown): string | undefined => {
    if (!dateVal) return undefined;
    const dateStr = String(dateVal);
    // Extrahiere nur den Datumsteil (YYYY-MM-DD)
    const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : dateStr.split('T')[0];
  };

  const parseFloExport = (data: Record<string, unknown>): ParsedFloData => {
    const cycles: Cycle[] = [];
    const logs: DailyLog[] = [];

    // Finde Periodendaten in verschiedenen möglichen Strukturen
    let periodData: Array<Record<string, unknown>> | undefined;

    // Struktur 1: Flo GDPR Export - operationalData.cycles
    const opData = data.operationalData as Record<string, unknown> | undefined;
    if (opData && Array.isArray(opData.cycles)) {
      periodData = opData.cycles as Array<Record<string, unknown>>;
    }

    // Struktur 2: Direkte Arrays
    if (!periodData) {
      periodData =
        (data.periods as Array<Record<string, unknown>>) ??
        (data.menstrual_cycles as Array<Record<string, unknown>>) ??
        (data.cycles as Array<Record<string, unknown>>) ??
        (data.cycle_data as Array<Record<string, unknown>>);
    }

    // Struktur 3: Unter "data" verschachtelt
    if (!periodData && data.data) {
      const nestedData = data.data as Record<string, unknown>;
      periodData =
        (nestedData.periods as Array<Record<string, unknown>>) ??
        (nestedData.cycles as Array<Record<string, unknown>>);
    }

    if (periodData && Array.isArray(periodData)) {
      for (const period of periodData) {
        // Flo GDPR Format: period_start_date, period_end_date
        const startDate = parseDate(
          period.period_start_date ??
          period.start_date ??
          period.startDate ??
          period.start ??
          period.date
        );

        if (startDate) {
          const endDate = parseDate(
            period.period_end_date ??
            period.end_date ??
            period.endDate ??
            period.end
          );

          const cycleLength =
            (period.cycle_length as number) ??
            (period.cycleLength as number);

          const periodLength =
            (period.period_length as number) ??
            (period.periodLength as number);

          cycles.push({
            startDate,
            endDate,
            length: cycleLength,
            periodLength,
          });
        }
      }
    }

    // Zyklen nach Datum sortieren
    cycles.sort((a, b) => a.startDate.localeCompare(b.startDate));

    // Zykluslängen berechnen falls nicht vorhanden
    for (let i = 0; i < cycles.length - 1; i++) {
      if (!cycles[i].length) {
        const start = new Date(cycles[i].startDate);
        const next = new Date(cycles[i + 1].startDate);
        cycles[i].length = Math.round(
          (next.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
        );
      }
    }

    // Periodenlängen berechnen aus Start/End falls vorhanden
    for (const cycle of cycles) {
      if (!cycle.periodLength && cycle.endDate) {
        const start = new Date(cycle.startDate);
        const end = new Date(cycle.endDate);
        cycle.periodLength = Math.round(
          (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
        ) + 1;
      }
    }

    // Flo-Tageslogs aus operationalData.point_events_manual_v2 zusammenführen
    const pointEvents = (opData?.point_events_manual_v2 as Array<Record<string, unknown>> | undefined) ?? [];
    if (Array.isArray(pointEvents) && pointEvents.length > 0) {
      const logsByDate = new Map<string, DailyLog>();

      for (const event of pointEvents) {
        const eventDate = parseDate(event.date);
        if (!eventDate) continue;

        const existing = logsByDate.get(eventDate) ?? {
          date: eventDate,
          symptoms: [],
          disturbers: [],
        };

        const category = String(event.category ?? '');
        const subcategory = String(event.subcategory ?? '');

        if (category === 'Period') {
          const flowNum = Number(event.value);
          if (!Number.isNaN(flowNum) && flowNum in FLO_FLOW_MAP) {
            existing.flow = FLO_FLOW_MAP[flowNum as keyof typeof FLO_FLOW_MAP];
          }
          existing.isPeriod = true;
        } else if (category === 'Symptom' && subcategory) {
          const symptom = subcategory as DailyLog['symptoms'][number];
          if (!existing.symptoms.includes(symptom)) {
            existing.symptoms.push(symptom);
          }
        } else if (category === 'Mood' && subcategory) {
          existing.mood = subcategory as DailyLog['mood'];
        } else if (category === 'Fluid' && subcategory) {
          existing.fluid = subcategory as DailyLog['fluid'];
        } else if (category === 'Disturber' && subcategory) {
          if (!existing.disturbers.includes(subcategory as DailyLog['disturbers'][number])) {
            existing.disturbers.push(subcategory as DailyLog['disturbers'][number]);
          }
        } else if (category === 'SexDrive' && subcategory) {
          existing.sexDrive = subcategory as DailyLog['sexDrive'];
        } else if (category === 'Bbt') {
          const temp = Number(event.value);
          if (!Number.isNaN(temp)) {
            existing.temperature = temp;
          }
        }

        logsByDate.set(eventDate, existing);
      }

      logs.push(...Array.from(logsByDate.values()).sort((a, b) => a.date.localeCompare(b.date)));
    }

    // Fallback für Exporte mit bereits strukturierten Tageslogs
    const directLogs =
      (data.daily_logs as Array<Record<string, unknown>> | undefined) ??
      (data.logs as Array<Record<string, unknown>> | undefined) ??
      ((data.data as Record<string, unknown> | undefined)?.daily_logs as Array<Record<string, unknown>> | undefined) ??
      ((data.data as Record<string, unknown> | undefined)?.logs as Array<Record<string, unknown>> | undefined);

    if (logs.length === 0 && Array.isArray(directLogs)) {
      for (const entry of directLogs) {
        const logDate = parseDate(entry.date ?? entry.log_date);
        if (!logDate) continue;
        logs.push({
          date: logDate,
          flow: entry.flow as DailyLog['flow'],
          symptoms: (entry.symptoms as DailyLog['symptoms']) ?? [],
          mood: entry.mood as DailyLog['mood'],
          fluid: entry.fluid as DailyLog['fluid'],
          sexDrive: entry.sex_drive as DailyLog['sexDrive'],
          disturbers: (entry.disturbers as DailyLog['disturbers']) ?? [],
          temperature: typeof entry.temperature === 'number' ? entry.temperature : undefined,
          notes: typeof entry.notes === 'string' ? entry.notes : undefined,
          isPeriod: Boolean(entry.is_period ?? entry.flow),
        });
      }
    }

    return { cycles, logs };
  };

  const handleFile = async (file: File) => {
    setIsProcessing(true);
    setResult(null);

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (importType === 'model') {
        // Modellparameter importieren (snake_case von Python zu camelCase konvertieren)
        const converted = snakeToCamel(data as Record<string, unknown>);
        const modelParams = converted as unknown as ModelParams;
        if (!modelParams.prediction || !modelParams.trainedAt) {
          throw new Error('Ungültige Modellparameter-Datei');
        }
        await saveModelParams(modelParams);
        await refreshData();
        setResult({
          success: true,
          message: `Modell erfolgreich importiert! Trainiert mit ${modelParams.cyclesTrained} Zyklen.`,
        });
      } else if (importType === 'flo') {
        // Flo-Daten parsen und importieren
        const { cycles, logs } = parseFloExport(data);
        if (cycles.length === 0) {
          throw new Error('Keine Zyklusdaten in der Datei gefunden');
        }
        await importCycles(cycles);
        if (logs.length > 0) {
          await importLogs(logs);
        }
        await refreshData();
        setResult({
          success: true,
          message: `${cycles.length} Zyklen importiert${logs.length > 0 ? ` und ${logs.length} Einträge` : ''}. Führe jetzt das Python-Training aus, um Vorhersagen zu generieren.`,
        });
      } else if (importType === 'backup') {
        // App-Backup importieren
        const backup = data as { cycles: Cycle[]; logs: DailyLog[]; modelParams?: ModelParams | null };
        if (backup.cycles) {
          await importCycles(backup.cycles);
        }
        if (backup.logs) {
          await importLogs(backup.logs);
        }
        if (backup.modelParams) {
          await saveModelParams(backup.modelParams);
        }
        await refreshData();
        setResult({
          success: true,
          message: `Backup wiederhergestellt: ${backup.cycles?.length ?? 0} Zyklen, ${backup.logs?.length ?? 0} Einträge${backup.modelParams ? ', Modellparameter' : ''}.`,
        });
      }
    } catch (error) {
      console.error('Import-Fehler:', error);
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Import fehlgeschlagen',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/json') {
      handleFile(file);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  return (
    <div className="p-4 max-w-lg mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-primary-800">Daten importieren</h1>
        <p className="text-sm text-gray-500">
          Importiere Zyklusdaten oder Modellparameter
        </p>
      </header>

      {/* Import-Typ Auswahl */}
      <div className="card mb-4">
        <h3 className="font-medium mb-3">Was möchtest du importieren?</h3>
        <div className="space-y-2">
          <label className="flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer hover:bg-sky-50 transition-colors has-[:checked]:border-primary-600 has-[:checked]:bg-primary-50">
            <input
              type="radio"
              name="importType"
              value="model"
              checked={importType === 'model'}
              onChange={() => setImportType('model')}
              className="text-primary-600"
            />
            <div>
              <div className="font-medium">Modellparameter</div>
              <div className="text-sm text-gray-500">
                model_params.json vom Python-Training importieren
              </div>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer hover:bg-sky-50 transition-colors has-[:checked]:border-primary-600 has-[:checked]:bg-primary-50">
            <input
              type="radio"
              name="importType"
              value="flo"
              checked={importType === 'flo'}
              onChange={() => setImportType('flo')}
              className="text-primary-600"
            />
            <div>
              <div className="font-medium">Flo-Export</div>
              <div className="text-sm text-gray-500">
                Historische Daten aus der Flo-App importieren
              </div>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer hover:bg-sky-50 transition-colors has-[:checked]:border-primary-600 has-[:checked]:bg-primary-50">
            <input
              type="radio"
              name="importType"
              value="backup"
              checked={importType === 'backup'}
              onChange={() => setImportType('backup')}
              className="text-primary-600"
            />
            <div>
              <div className="font-medium">App-Backup</div>
              <div className="text-sm text-gray-500">
                Aus einem früheren FLux-Export wiederherstellen
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Drop-Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`card border-2 border-dashed transition-colors ${
          isDragging
            ? 'border-primary-600 bg-primary-50'
            : 'border-sky-300 hover:border-sky-400'
        }`}
      >
        <div className="text-center py-8">
          <FileJson className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600 mb-2">
            {isProcessing
              ? 'Verarbeite...'
              : 'JSON-Datei hierher ziehen'}
          </p>
          <p className="text-sm text-gray-500 mb-4">oder</p>
          <label className="btn btn-primary cursor-pointer inline-flex items-center">
            <Upload className="w-5 h-5 mr-2" />
            Datei auswählen
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleFileInput}
              className="hidden"
              disabled={isProcessing}
            />
          </label>
        </div>
      </div>

      {/* Ergebnis-Nachricht */}
      {result && (
        <div
          className={`card mt-4 ${
            result.success
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}
        >
          <div className="flex items-start gap-3">
            {result.success ? (
              <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            )}
            <p
              className={result.success ? 'text-green-800' : 'text-red-800'}
            >
              {result.message}
            </p>
          </div>
        </div>
      )}

      {/* Anleitungen */}
      <div className="card mt-4 bg-sky-50">
        <h3 className="font-medium mb-2">Anleitung</h3>
        {importType === 'model' && (
          <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
            <li>Exportiere deine Daten aus FLux (Einstellungen → Exportieren)</li>
            <li>
              Führe aus:{' '}
              <code className="bg-sky-200 px-1 rounded text-xs">
                python -m ml train -i exported_data.json -o model_params.json
              </code>
            </li>
            <li>Importiere die generierte model_params.json hier</li>
          </ol>
        )}
        {importType === 'flo' && (
          <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
            <li>Öffne Flo → Einstellungen → Daten herunterladen</li>
            <li>Warte auf die Export-E-Mail mit deiner JSON-Datei</li>
            <li>Importiere die JSON-Datei hier</li>
            <li>Führe das Python-Training aus, um Vorhersagen zu generieren</li>
          </ol>
        )}
        {importType === 'backup' && (
          <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
            <li>Verwende eine zuvor exportierte FLux-Backup-Datei</li>
            <li>Dies stellt alle Zyklen und Einträge wieder her</li>
          </ol>
        )}
      </div>

      {result?.success && (
        <button
          onClick={() => navigate('/')}
          className="w-full btn btn-primary mt-4"
        >
          Zum Dashboard
        </button>
      )}
    </div>
  );
}
