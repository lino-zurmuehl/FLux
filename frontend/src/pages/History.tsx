/**
 * Verlauf - Liste vergangener Zyklen und Vorhersage-Genauigkeit
 * (vorhergesagt vs. tatsächlich, pro Zyklus).
 */

import { useEffect, useMemo, useState } from 'react';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { CalendarRange, Target } from 'lucide-react';
import { getAllCycles, getPredictionHistory } from '../lib/db';
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

  useEffect(() => {
    async function load() {
      const [allCycles, history] = await Promise.all([
        getAllCycles(),
        getPredictionHistory(),
      ]);
      setCycles(allCycles);
      setRecords(history);
    }
    load();
  }, []);

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
              <div
                key={cycle.startDate}
                className="flex items-center justify-between rounded-xl border border-sky-100 bg-white px-3 py-2.5 text-sm"
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
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
