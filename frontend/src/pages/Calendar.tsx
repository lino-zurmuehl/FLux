/**
 * Kalender - Monatsansicht mit Perioden-, Vorhersage- und Fruchtbarkeits-
 * Markierungen. Tippe auf einen Tag, um den Eintrag zu sehen.
 */

import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  differenceInCalendarDays,
} from 'date-fns';
import { de } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { getAllCycles, getLogsInRange } from '../lib/db';
import { isValidDate, periodEndFor, shiftDate } from '../lib/periodDates';
import { saveCalendarPeriod, deleteCalendarPeriod } from '../lib/periodActions';
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

type Draft = { id?: number; start: string; end?: string; autoEnded?: boolean };
type EditMode = 'range' | 'start' | 'end';

export function Calendar() {
  const { modelParams, refreshData, dataVersion } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedDate = searchParams.get('date');
  const initialDate = requestedDate && isValidDate(requestedDate) ? requestedDate : format(new Date(), 'yyyy-MM-dd');
  const [month, setMonth] = useState(() => startOfMonth(parseISO(initialDate)));
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [logs, setLogs] = useState<Map<string, DailyLog>>(new Map());
  const [selectedDay, setSelectedDay] = useState<string | null>(
    initialDate
  );
  const [editing, setEditing] = useState(searchParams.get('edit') === 'period');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editMode, setEditMode] = useState<EditMode>('range');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const initialSelectionDone = useRef(false);
  const gesture = useRef<{ from: string; last: string; mode: EditMode | 'move'; original: Draft; previous: Draft | null; pointerId: number } | null>(null);

  const todayIso = format(new Date(), 'yyyy-MM-dd');
  const prediction = modelParams?.prediction ?? null;

  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [allCycles, monthLogs] = await Promise.all([
        getAllCycles(),
        getLogsInRange(format(gridStart, 'yyyy-MM-dd'), format(gridEnd, 'yyyy-MM-dd')),
      ]);
      if (cancelled) return;
      setCycles(allCycles);
      setLogs(new Map(monthLogs.map((l) => [l.date, l])));
      if (!initialSelectionDone.current) {
        initialSelectionDone.current = true;
        if (editing) {
          const cycle = allCycles.find((item) => initialDate >= item.startDate && initialDate <= periodEndFor(item, todayIso));
          if (cycle) setDraft({ id: cycle.id, start: cycle.startDate, end: cycle.endDate, autoEnded: cycle.autoEnded });
        }
      }
    }
    void load().catch(() => { if (!cancelled) setError('Der Kalender konnte nicht geladen werden.'); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, dataVersion]);

  // Alle Periodentage als Set von ISO-Daten (nur sichtbarer Bereich relevant)
  const periodDays = useMemo(() => {
    const set = new Set<string>();
    cycles.forEach((cycle) => {
      if (editing && draft?.id === cycle.id) return;
      const end = periodEndFor(cycle, todayIso);
      // Bound rendering to visible dates, even for malformed imported history.
      days.forEach((date) => {
        const iso = format(date, 'yyyy-MM-dd');
        if (iso >= cycle.startDate && iso <= end) set.add(iso);
      });
    });
    return set;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycles, todayIso, month, editing, draft?.id]);

  const draftEnd = draft && isValidDate(draft.start) ? draft.end ?? periodEndFor({ startDate: draft.start }, todayIso) : '';
  const inDraft = (iso: string) => Boolean(editing && draft && isValidDate(draft.start) && iso >= draft.start && iso <= draftEnd);

  const selectDate = (iso: string): { draft: Draft; mode: EditMode | 'move' } | null => {
    setSelectedDay(iso);
    if (!editing || isSaving || iso > todayIso) return null;
    setError('');
    setMessage('');
    if (draft && editMode !== 'range') {
      const updated = { ...draft, [editMode]: iso, autoEnded: false };
      setDraft(updated);
      return { draft: updated, mode: editMode };
    }
    const cycle = cycles.find((item) => iso >= item.startDate && iso <= periodEndFor(item, todayIso));
    const next: Draft = cycle
      ? { id: cycle.id, start: cycle.startDate, end: cycle.endDate, autoEnded: cycle.autoEnded }
      : { start: iso, end: [shiftDate(iso, 4), todayIso].sort()[0] };
    setDraft(next);
    return { draft: next, mode: cycle ? 'move' : 'range' };
  };

  const beginGesture = (event: PointerEvent<HTMLButtonElement>, iso: string) => {
    if (!editing || isSaving || event.button !== 0) return;
    const result = selectDate(iso);
    if (!result) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { from: iso, last: iso, original: result.draft, previous: draft, mode: result.mode, pointerId: event.pointerId };
  };

  const moveGesture = (event: PointerEvent<HTMLButtonElement>) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-calendar-date]');
    const iso = target?.dataset.calendarDate;
    if (!iso || iso > todayIso || iso === current.last) return;
    current.last = iso;
    const original = current.original;
    if (current.mode === 'move') {
      const offset = differenceInCalendarDays(parseISO(iso), parseISO(current.from));
      setDraft({ ...original, start: shiftDate(original.start, offset), end: original.end ? shiftDate(original.end, offset) : undefined });
    } else if (current.mode === 'range') {
      const [start, end] = [current.from, iso].sort();
      setDraft({ start, end });
    } else {
      setDraft({ ...original, [current.mode]: iso, autoEnded: false });
    }
    setSelectedDay(iso);
  };

  const saveDraft = async () => {
    if (!draft) return;
    setIsSaving(true);
    setError('');
    try {
      const result = await saveCalendarPeriod(draft.start, draft.end, draft.id);
      if (!result.ok) { setError(result.error ?? 'Die Periode konnte nicht gespeichert werden.'); return; }
      await refreshData();
      setDraft(null);
      setEditing(false);
      setEditMode('range');
      setMessage('Periode gespeichert.');
    } catch {
      setError('Die Änderung konnte nicht gespeichert werden. Bitte versuche es erneut.');
    } finally { setIsSaving(false); }
  };

  const deleteDraft = async () => {
    if (draft?.id === undefined || !window.confirm('Diese Periode löschen? Symptome und Notizen bleiben erhalten.')) return;
    setIsSaving(true);
    setError('');
    try {
      await deleteCalendarPeriod(draft.id);
      await refreshData();
      setDraft(null);
      setEditing(false);
      setMessage('Periode gelöscht.');
    } catch { setError('Die Periode konnte nicht gelöscht werden.'); }
    finally { setIsSaving(false); }
  };

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

    if (inDraft(iso)) {
      base += 'bg-primary-100 border-2 border-primary-600 text-primary-800 font-bold ';
    } else if (kind === 'period') {
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
        <p className="text-sm text-gray-500">Perioden ansehen, nachtragen und korrigieren</p>
      </header>

      <div className="flex gap-2 mb-3">
        <button disabled={isSaving} onClick={() => {
          setEditing(!editing); setDraft(null); setEditMode('range'); setError(''); setMessage('');
        }} className={`btn flex-1 ${editing ? 'btn-secondary' : 'btn-primary'}`}>
          {editing ? 'Bearbeitung schließen' : 'Periode bearbeiten / nachtragen'}
        </button>
        {editing && draft && <button disabled={isSaving} onClick={() => { setDraft(null); setEditMode('range'); }} className="btn btn-secondary">Neue</button>}
      </div>
      {editing && <p className="text-sm text-gray-600 mb-3" id="calendar-help">
        {editMode === 'range'
          ? 'Tippe auf eine Periode und ziehe sie zum Verschieben. Für eine fehlende Periode tippe auf den Starttag oder ziehe über den Zeitraum. Danach speichern.'
          : `Tippe auf den neuen ${editMode === 'start' ? 'Starttag' : 'Endtag'}. Du kannst auch das Datum unten eingeben.`}
      </p>}
      {message && <p role="status" className="text-sm text-emerald-700 mb-3">{message}</p>}
      {error && <p role="alert" className="text-sm text-red-600 mb-3">{error}</p>}

      <div className="card p-4">
        {/* Monatsnavigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setMonth(subMonths(month, 1))}
            aria-label="Vorheriger Monat"
            className="p-2 rounded-full hover:bg-sky-100 text-gray-600"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="font-bold text-gray-800 capitalize">
            {format(month, 'MMMM yyyy', { locale: de })}
          </span>
          <button
            onClick={() => setMonth(addMonths(month, 1))}
            aria-label="Nächster Monat"
            className="p-2 rounded-full hover:bg-sky-100 text-gray-600"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {editing && draft && <div className="flex gap-2 mb-4" aria-label="Periodendaten auswählen">
          {([
            ['range', draft.id === undefined ? 'Zeitraum' : 'Verschieben'],
            ['start', 'Start ändern'],
            ['end', 'Ende ändern'],
          ] as const).map(([mode, label]) => <button key={mode} disabled={isSaving} aria-pressed={editMode === mode} onClick={() => setEditMode(mode)} className={`flex-1 text-xs font-medium py-2 rounded-xl border ${editMode === mode ? 'border-primary-400 bg-primary-50 text-primary-800' : 'border-sky-100 text-gray-600'}`}>{label}</button>)}
        </div>}

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
        <div className="grid grid-cols-7 gap-1" style={{ touchAction: editing ? 'none' : 'auto' }} aria-describedby={editing ? 'calendar-help' : undefined}>
          {days.map((date) => {
            const iso = format(date, 'yyyy-MM-dd');
            const kind = classify(iso);
            const hasLog = logs.has(iso);
            return (
              <button
                key={iso}
                data-calendar-date={iso}
                aria-label={`${format(date, 'EEEE, d. MMMM yyyy', { locale: de })}${kind === 'period' ? ', Periode' : ''}${inDraft(iso) ? ', ausgewählter Zeitraum' : ''}`}
                aria-pressed={inDraft(iso) || selectedDay === iso}
                disabled={isSaving || (editing && iso > todayIso)}
                onClick={(event) => {
                  if (!editing) setSelectedDay(iso);
                  else if (event.detail === 0) selectDate(iso);
                }}
                onPointerDown={(event) => beginGesture(event, iso)}
                onPointerMove={moveGesture}
                onPointerUp={() => { gesture.current = null; }}
                onPointerCancel={() => { if (gesture.current) setDraft(gesture.current.previous); gesture.current = null; }}
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
            Rund um den Eisprung
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />
            Eintrag
          </span>
        </div>
      </div>

      {editing && draft && <section className="card mt-4" aria-label="Periode bearbeiten">
        <h2 className="font-semibold text-gray-800 mb-3">{draft.id === undefined ? 'Periode nachtragen' : 'Periode korrigieren'}</h2>
        {draft.autoEnded && <p className="text-xs text-gray-500 mb-3">Das Ende wurde automatisch angenommen. Prüfe die Daten und passe sie bei Bedarf an.</p>}
        <div className="grid grid-cols-2 gap-3">
          <label className="label">Start
            <input type="date" value={draft.start} max={todayIso} disabled={isSaving} onChange={(event) => setDraft({ ...draft, start: event.target.value })} className="input mt-1" />
          </label>
          <label className="label">Letzter Periodentag
            <input type="date" value={draft.end ?? ''} min={draft.start} max={todayIso} disabled={isSaving} onChange={(event) => setDraft({ ...draft, end: event.target.value || undefined, autoEnded: false })} className="input mt-1" />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 mt-3">
          <input type="checkbox" checked={!draft.end} disabled={isSaving || !isValidDate(draft.start)} onChange={(event) => setDraft({ ...draft, end: event.target.checked ? undefined : [shiftDate(draft.start, 4), todayIso].sort()[0], autoEnded: false })} />
          Periode läuft noch
        </label>
        <p className="text-xs text-gray-500 mt-2">Ohne Enddatum wird sie nach 5 Tagen automatisch beendet. Längere Perioden kannst du mit einem Enddatum erfassen.</p>
        <div className="flex gap-2 mt-4">
          <button onClick={() => void saveDraft()} disabled={isSaving || !draft.start} className="btn btn-primary flex-1">{isSaving ? 'Speichern…' : 'Periode speichern'}</button>
          {draft.id !== undefined && <button onClick={() => void deleteDraft()} disabled={isSaving} className="btn bg-red-50 text-red-700" aria-label="Periode löschen"><Trash2 className="w-5 h-5" /></button>}
        </div>
      </section>}

      {/* Tagesdetail */}
      {selectedDay && !editing && (
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
