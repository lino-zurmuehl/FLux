/**
 * Verlauf - Liste vergangener Zyklen und Vorhersage-Genauigkeit
 * (vorhergesagt vs. tatsächlich, pro Zyklus).
 */

import { useEffect, useMemo, useState } from 'react';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { CalendarRange, Target, Pencil, Trash2, Save, X } from 'lucide-react';
import {
  clearModelParams,
  clearModelParamsBackup,
  deleteCycleAndRelatedData,
  getAllCycles,
  getLatestCycle,
  getPredictionHistory,
  updateCycle,
  updatePredictionRecordStartDate,
  updatePredictionForNewCycle,
} from '../lib/db';
import { maybeAutoRetrain } from '../lib/periodActions';
import { useApp } from '../contexts/AppContext';
import type { Cycle, PredictionRecord } from '../lib/types';

interface AccuracyRow {
  startDate: string;
  predictedDate: string;
  errorDays: number;
  source: 'model' | 'estimate';
}

function errorBadgeClass(errorDays: number): string {
  const abs = Math.abs(errorDays);
  if (abs <= 1) return 'bg-emerald-100 text-emerald-700';
  if (abs <= 3) return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
}

function errorLabel(errorDays: number): string {
  if (errorDays === 0) return 'exakt';
  const abs = Math.abs(errorDays);
  const unit = abs === 1 ? 'Tag' : 'Tage';
  return errorDays > 0 ? `${abs} ${unit} später` : `${abs} ${unit} früher`;
}

export function History() {
  const { modelParams } = useApp();
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [records, setRecords] = useState<PredictionRecord[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [isMutating, setIsMutating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = async () => {
    const [allCycles, history] = await Promise.all([
      getAllCycles(),
      getPredictionHistory(),
    ]);
    setCycles(allCycles);
    setRecords(history);
  };

  useEffect(() => {
    void load();
  }, []);

  const refreshPredictionAfterChange = async () => {
    const latest = await getLatestCycle();
    if (!latest) {
      await clearModelParams();
      await clearModelParamsBackup();
      return;
    }
    const retrained = await maybeAutoRetrain();
    if (!retrained) await updatePredictionForNewCycle(latest.startDate);
  };

  const beginEdit = (cycle: Cycle) => {
    setActionError(null);
    setEditingId(cycle.id ?? null);
    setEditStartDate(cycle.startDate);
    setEditEndDate(cycle.endDate ?? '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setActionError(null);
  };

  const saveEdit = async (cycle: Cycle) => {
    if (!cycle.id || !editStartDate) return;
    setActionError(null);

    if (editEndDate && editEndDate < editStartDate) {
      setActionError('Das Enddatum kann nicht vor dem Startdatum liegen.');
      return;
    }

    const index = cycles.findIndex((item) => item.id === cycle.id);
    const previous = index > 0 ? cycles[index - 1] : undefined;
    const next = index < cycles.length - 1 ? cycles[index + 1] : undefined;
    if (previous && editStartDate <= previous.startDate) {
      setActionError('Der Start muss nach dem vorherigen Periodenstart liegen.');
      return;
    }
    if (next && editStartDate >= next.startDate) {
      setActionError('Der Start muss vor dem nächsten Periodenstart liegen.');
      return;
    }

    setIsMutating(true);
    try {
      const periodLength = editEndDate
        ? differenceInCalendarDays(parseISO(editEndDate), parseISO(editStartDate)) + 1
        : undefined;
      await updateCycle(cycle.id, {
        startDate: editStartDate,
        endDate: editEndDate || undefined,
        periodLength,
      });
      if (cycle.startDate !== editStartDate) {
        await updatePredictionRecordStartDate(cycle.startDate, editStartDate);
      }
      await refreshPredictionAfterChange();
      await load();
      cancelEdit();
    } catch (error) {
      console.error('Zyklusänderung fehlgeschlagen:', error);
      setActionError('Die Änderung konnte nicht gespeichert werden.');
    } finally {
      setIsMutating(false);
    }
  };

  const deleteCycle = async (cycle: Cycle) => {
    if (!cycle.id) return;
    const confirmed = window.confirm(
      'Diesen Periodeneintrag wirklich löschen? Perioden-Markierungen in diesem Zeitraum und die zugehörige Vorhersage-Aufzeichnung werden entfernt.'
    );
    if (!confirmed) return;

    setIsMutating(true);
    setActionError(null);
    try {
      await deleteCycleAndRelatedData(cycle.id);
      await refreshPredictionAfterChange();
      await load();
      if (editingId === cycle.id) cancelEdit();
    } catch (error) {
      console.error('Zyklus löschen fehlgeschlagen:', error);
      setActionError('Der Periodeneintrag konnte nicht gelöscht werden.');
    } finally {
      setIsMutating(false);
    }
  };

  // Zykluslängen: gespeicherte Länge oder Abstand zum nächsten Start
  const cycleRows = useMemo(() => {
    return cycles.map((cycle, i) => {
      const next = cycles[i + 1];
      const length =
        cycle.length ??
        (next
          ? differenceInCalendarDays(parseISO(next.startDate), parseISO(cycle.startDate))
          : undefined);
      return { cycle, length, isCurrent: !next };
    });
  }, [cycles]);

  const avgLength = useMemo(() => {
    const known = cycleRows.filter((r) => r.length).map((r) => r.length as number);
    if (modelParams?.avgCycleLength) return modelParams.avgCycleLength;
    if (known.length === 0) return null;
    return known.reduce((a, b) => a + b, 0) / known.length;
  }, [cycleRows, modelParams]);

  // Genauigkeit: echte Modell-Aufzeichnungen plus Schätzungen für ältere
  // Zyklen (Durchschnitt der vorherigen Zykluslängen als naive Vorhersage).
  const accuracyRows = useMemo(() => {
    const rows: AccuracyRow[] = records.map((r) => ({
      startDate: r.cycleStartDate,
      predictedDate: r.predictedDate,
      errorDays: r.errorDays,
      source: 'model',
    }));
    const recorded = new Set(records.map((r) => r.cycleStartDate));

    // Lücken zwischen aufeinanderfolgenden Starts
    const gaps: number[] = [];
    for (let i = 1; i < cycles.length; i++) {
      gaps.push(
        differenceInCalendarDays(
          parseISO(cycles[i].startDate),
          parseISO(cycles[i - 1].startDate)
        )
      );
    }

    for (let i = 3; i < cycles.length; i++) {
      const startDate = cycles[i].startDate;
      if (recorded.has(startDate)) continue;

      // Nur Lücken VOR dem vorherzusagenden Zyklus verwenden (max. 6)
      const priorGaps = gaps.slice(Math.max(0, i - 7), i - 1);
      if (priorGaps.length < 2) continue;
      const meanGap = Math.round(
        priorGaps.reduce((a, b) => a + b, 0) / priorGaps.length
      );

      const prevStart = parseISO(cycles[i - 1].startDate);
      const predicted = new Date(prevStart);
      predicted.setDate(predicted.getDate() + meanGap);
      const predictedIso = format(predicted, 'yyyy-MM-dd');

      rows.push({
        startDate,
        predictedDate: predictedIso,
        errorDays: differenceInCalendarDays(parseISO(startDate), predicted),
        source: 'estimate',
      });
    }

    return rows.sort((a, b) => b.startDate.localeCompare(a.startDate));
  }, [records, cycles]);

  const accuracySummary = useMemo(() => {
    if (accuracyRows.length === 0) return null;
    const absErrors = accuracyRows.map((r) => Math.abs(r.errorDays));
    const mae = absErrors.reduce((a, b) => a + b, 0) / absErrors.length;
    const within2 = absErrors.filter((e) => e <= 2).length;
    return {
      mae,
      within2Percent: Math.round((within2 / absErrors.length) * 100),
      count: absErrors.length,
    };
  }, [accuracyRows]);

  if (cycles.length === 0) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <header className="mb-4">
          <h1 className="text-2xl font-bold text-primary-800">Verlauf</h1>
        </header>
        <div className="card text-center text-gray-500">
          Noch keine Zyklen erfasst. Importiere deine Daten oder erfasse deine
          erste Periode.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-lg mx-auto pb-8">
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-primary-800">Verlauf</h1>
        <p className="text-sm text-gray-500">
          Vergangene Zyklen und wie gut die Vorhersagen waren
        </p>
      </header>

      {/* Vorhersage-Genauigkeit */}
      <div className="card mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-5 h-5 text-sky-600" />
          <h3 className="font-semibold text-gray-800">Vorhersage-Genauigkeit</h3>
        </div>

        {accuracySummary ? (
          <>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-xl bg-sky-50/70 border border-sky-100 p-3">
                <div className="text-xs text-gray-500">Mittlere Abweichung</div>
                <div className="font-bold text-gray-800 mt-0.5">
                  {accuracySummary.mae.toFixed(1)} Tage
                </div>
              </div>
              <div className="rounded-xl bg-sky-50/70 border border-sky-100 p-3">
                <div className="text-xs text-gray-500">Innerhalb von 2 Tagen</div>
                <div className="font-bold text-gray-800 mt-0.5">
                  {accuracySummary.within2Percent}%
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {accuracyRows.map((row) => (
                <div
                  key={row.startDate}
                  className="flex items-center justify-between rounded-xl border border-sky-100 bg-white px-3 py-2.5 text-sm"
                >
                  <div>
                    <div className="font-medium text-gray-800">
                      {format(parseISO(row.startDate), 'd. MMM yyyy', { locale: de })}
                    </div>
                    <div className="text-xs text-gray-500">
                      Vorhergesagt:{' '}
                      {format(parseISO(row.predictedDate), 'd. MMM', { locale: de })}
                      {row.source === 'estimate' && ' (Schätzung)'}
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold ${errorBadgeClass(row.errorDays)}`}
                  >
                    {errorLabel(row.errorDays)}
                  </span>
                </div>
              ))}
            </div>

            <p className="text-xs text-gray-400 mt-3">
              Zeilen mit (Schätzung) nutzen den Durchschnitt der vorherigen Zyklen,
              da für sie keine Modell-Vorhersage aufgezeichnet wurde.
            </p>
          </>
        ) : (
          <p className="text-sm text-gray-500">
            Die Genauigkeit wird sichtbar, sobald neue Periodenstarts mit aktiver
            Vorhersage erfasst werden.
          </p>
        )}
      </div>

      {/* Zyklus-Liste */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <CalendarRange className="w-5 h-5 text-primary-600" />
          <h3 className="font-semibold text-gray-800">
            Zyklen ({cycles.length})
          </h3>
        </div>

        <div className="space-y-2">
          {[...cycleRows].reverse().map(({ cycle, length, isCurrent }) => {
            const deviation =
              length && avgLength ? Math.round(length - avgLength) : null;
            return (
              editingId === cycle.id ? (
                <div key={cycle.startDate} className="rounded-xl border border-primary-200 bg-primary-50 p-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <label className="label">
                      Startdatum
                      <input
                        type="date"
                        value={editStartDate}
                        onChange={(event) => setEditStartDate(event.target.value)}
                        max={format(new Date(), 'yyyy-MM-dd')}
                        className="input text-sm mt-1"
                      />
                    </label>
                    <label className="label">
                      Enddatum
                      <input
                        type="date"
                        value={editEndDate}
                        onChange={(event) => setEditEndDate(event.target.value)}
                        min={editStartDate}
                        max={format(new Date(), 'yyyy-MM-dd')}
                        className="input text-sm mt-1"
                      />
                    </label>
                  </div>
                  {actionError && <p className="text-xs text-red-600 mt-2">{actionError}</p>}
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => void saveEdit(cycle)} disabled={isMutating} className="btn btn-primary flex-1 flex items-center justify-center gap-1">
                      <Save className="w-4 h-4" /> Speichern
                    </button>
                    <button onClick={cancelEdit} disabled={isMutating} className="btn bg-white text-gray-600 flex-1 flex items-center justify-center gap-1">
                      <X className="w-4 h-4" /> Abbrechen
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  key={cycle.startDate}
                  className="flex items-center justify-between rounded-xl border border-sky-100 bg-white px-3 py-2.5 text-sm gap-2"
                >
                  <div>
                    <div className="font-medium text-gray-800">
                      {format(parseISO(cycle.startDate), 'd. MMM yyyy', { locale: de })}
                      {isCurrent && (
                        <span className="ml-2 text-xs font-semibold text-primary-600">
                          Aktuell
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {cycle.periodLength
                        ? `Periode: ${cycle.periodLength} Tage`
                        : cycle.endDate
                          ? `Periode bis ${format(parseISO(cycle.endDate), 'd. MMM', { locale: de })}`
                          : 'Periode läuft'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <div className="font-semibold text-gray-800">
                        {length ? `${length} Tage` : 'offen'}
                      </div>
                      {deviation !== null && deviation !== 0 && (
                        <div
                          className={`text-xs font-medium ${
                            Math.abs(deviation) <= 2 ? 'text-gray-400' : 'text-amber-600'
                          }`}
                        >
                          {deviation > 0 ? `+${deviation}` : deviation} vs. Ø
                        </div>
                      )}
                    </div>
                    <button onClick={() => beginEdit(cycle)} disabled={isMutating} className="p-2 text-primary-700 hover:bg-primary-50 rounded-lg" aria-label="Zyklus bearbeiten">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => void deleteCycle(cycle)} disabled={isMutating} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" aria-label="Zyklus löschen">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            );
          })}
        </div>
        {actionError && editingId === null && (
          <p className="text-sm text-red-600 mt-3">{actionError}</p>
        )}
      </div>
    </div>
  );
}
