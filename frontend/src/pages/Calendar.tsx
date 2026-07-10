/**
 * Kalender - Monatsansicht mit Perioden-, Vorhersage- und Fruchtbarkeits-
 * Markierungen. Tippe auf einen Tag, um den Eintrag zu sehen.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { de } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Pencil, Plus } from 'lucide-react';
import { getAllCycles, getLogsInRange } from '../lib/db';
import { useApp } from '../contexts/AppContext';
import {
  FLOW_INTENSITIES,
  SYMPTOM_LABELS,
  MOOD_LABELS,
  FLUID_LABELS,
  DISTURBER_LABELS,
  SEX_DRIVE_LABELS,
  type Cycle,
  type DailyLog,
} from '../lib/types';

type DayKind = 'period' | 'predicted' | 'fertile' | 'plain';

function periodEndFor(cycle: Cycle, isLatest: boolean, todayIso: string): string {
  if (cycle.endDate) return cycle.endDate;
  if (cycle.periodLength && cycle.periodLength > 0) {
    return format(addDays(parseISO(cycle.startDate), cycle.periodLength - 1), 'yyyy-MM-dd');
  }
  return isLatest ? todayIso : cycle.startDate;
}

export function Calendar() {
  const { modelParams } = useApp();
  const navigate = useNavigate();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [logs, setLogs] = useState<Map<string, DailyLog>>(new Map());
  const [selectedDay, setSelectedDay] = useState<string | null>(
    format(new Date(), 'yyyy-MM-dd')
  );

  const todayIso = format(new Date(), 'yyyy-MM-dd');
  const prediction = modelParams?.prediction ?? null;

  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  useEffect(() => {
    async function load() {
      const [allCycles, monthLogs] = await Promise.all([
        getAllCycles(),
        getLogsInRange(format(gridStart, 'yyyy-MM-dd'), format(gridEnd, 'yyyy-MM-dd')),
      ]);
      setCycles(allCycles);
      setLogs(new Map(monthLogs.map((l) => [l.date, l])));
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  // Alle Periodentage als Set von ISO-Daten (nur sichtbarer Bereich relevant)
  const periodDays = useMemo(() => {
    const set = new Set<string>();
    cycles.forEach((cycle, i) => {
      const isLatest = i === cycles.length - 1;
      const end = periodEndFor(cycle, isLatest, todayIso);
      let d = parseISO(cycle.startDate);
      let iso = cycle.startDate;
      while (iso <= end) {
        set.add(iso);
        d = addDays(d, 1);
        iso = format(d, 'yyyy-MM-dd');
      }
    });
    return set;
  }, [cycles, todayIso]);

  const classify = (iso: string): DayKind => {
    if (periodDays.has(iso)) return 'period';
    if (prediction?.nextPeriodDate) {
      const predEnd = format(
        addDays(
          parseISO(prediction.nextPeriodDate),
          Math.max(1, prediction.periodLength ?? 5) - 1
        ),
        'yyyy-MM-dd'
      );
      if (iso >= prediction.nextPeriodDate && iso <= predEnd) return 'predicted';
    }
    if (
      prediction?.fertileWindowStart &&
      prediction?.fertileWindowEnd &&
      iso >= prediction.fertileWindowStart &&
      iso <= prediction.fertileWindowEnd
    ) {
      return 'fertile';
    }
    return 'plain';
  };

  const dayStyle = (kind: DayKind, iso: string, inMonth: boolean): string => {
    const selected = selectedDay === iso;
    const isToday = iso === todayIso;
    let base = 'relative w-full aspect-square rounded-full flex flex-col items-center justify-center text-sm transition-all ';

    if (!inMonth) base += 'opacity-30 ';

    if (kind === 'period') {
      base += 'bg-gradient-to-b from-primary-400 to-primary-600 text-white font-semibold ';
    } else if (kind === 'predicted') {
      base += 'border-2 border-dashed border-primary-300 text-primary-700 bg-primary-50/60 ';
    } else if (kind === 'fertile') {
      base += 'border-2 border-sky-300 text-sky-700 bg-sky-50 ';
    } else {
      base += 'text-gray-700 ';
    }

    if (isToday) base += 'ring-2 ring-primary-600 ring-offset-1 font-bold ';
    if (selected) base += 'ring-2 ring-primary-800 ring-offset-2 ';

    return base;
  };

  const selectedLog = selectedDay ? logs.get(selectedDay) : undefined;

  const logSummaryChips = (log: DailyLog): string[] => {
    const chips: string[] = [];
    if (log.flow) {
      const f = FLOW_INTENSITIES.find((o) => o.value === log.flow);
      if (f) chips.push(`Blutung: ${f.label}`);
    }
    log.symptoms?.forEach((s) => chips.push(SYMPTOM_LABELS[s]));
    if (log.mood) chips.push(MOOD_LABELS[log.mood]);
    if (log.fluid) chips.push(`Schleim: ${FLUID_LABELS[log.fluid]}`);
    if (log.sexDrive) chips.push(`Libido: ${SEX_DRIVE_LABELS[log.sexDrive]}`);
    log.disturbers?.forEach((d) => chips.push(DISTURBER_LABELS[d]));
    if (log.temperature) chips.push(`${log.temperature.toFixed(2)} °C`);
    return chips;
  };

  return (
    <div className="p-4 max-w-lg mx-auto pb-8">
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-primary-800">Kalender</h1>
        <p className="text-sm text-gray-500">Dein Zyklus im Monatsüberblick</p>
      </header>

      <div className="card p-4">
        {/* Monatsnavigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setMonth(subMonths(month, 1))}
            className="p-2 rounded-full hover:bg-sky-100 text-gray-600"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="font-bold text-gray-800 capitalize">
            {format(month, 'MMMM yyyy', { locale: de })}
          </span>
          <button
            onClick={() => setMonth(addMonths(month, 1))}
            className="p-2 rounded-full hover:bg-sky-100 text-gray-600"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Wochentage */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => (
            <div
              key={d}
              className="text-center text-[11px] font-semibold text-gray-400 uppercase"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Tage */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((date) => {
            const iso = format(date, 'yyyy-MM-dd');
            const kind = classify(iso);
            const hasLog = logs.has(iso);
            return (
              <button
                key={iso}
                onClick={() => setSelectedDay(iso)}
                className={dayStyle(kind, iso, isSameMonth(date, month))}
              >
                <span>{format(date, 'd')}</span>
                {hasLog && (
                  <span
                    className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${
                      kind === 'period' ? 'bg-white' : 'bg-primary-500'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Legende */}
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-4 text-[11px] text-gray-600">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-gradient-to-b from-primary-400 to-primary-600" />
            Periode
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full border-2 border-dashed border-primary-300" />
            Vorhergesagt
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full border-2 border-sky-300 bg-sky-50" />
            Fruchtbar
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />
            Eintrag
          </span>
        </div>
      </div>

      {/* Tagesdetail */}
      {selectedDay && (
        <div className="card mt-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-gray-800">
                {format(parseISO(selectedDay), 'EEEE, d. MMMM', { locale: de })}
              </h3>
              {periodDays.has(selectedDay) && (
                <span className="text-xs font-medium text-primary-600">Periodentag</span>
              )}
            </div>
            {selectedDay <= todayIso && (
              <button
                onClick={() => navigate(`/log?date=${selectedDay}`)}
                className="btn btn-secondary flex items-center gap-1.5 text-sm py-1.5"
              >
                {selectedLog ? (
                  <>
                    <Pencil className="w-4 h-4" />
                    Bearbeiten
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Eintrag
                  </>
                )}
              </button>
            )}
          </div>

          {selectedLog ? (
            <>
              <div className="flex flex-wrap gap-1.5">
                {logSummaryChips(selectedLog).map((chip) => (
                  <span
                    key={chip}
                    className="px-2.5 py-1 rounded-full bg-sky-50 border border-sky-100 text-xs text-gray-700"
                  >
                    {chip}
                  </span>
                ))}
              </div>
              {selectedLog.notes && (
                <p className="mt-3 text-sm text-gray-600 bg-sky-50/60 rounded-xl p-3">
                  {selectedLog.notes}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-500">
              {selectedDay > todayIso
                ? 'Zukünftiger Tag, noch kein Eintrag möglich.'
                : 'Kein Eintrag für diesen Tag.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
