/**
 * "Heute"-Karte der Startseite: Periodenstart/-ende ist immer die Hauptaktion,
 * Symptome sind nachrangig. Korrekturen laufen über den Kalender.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Droplet, CheckCircle2, CalendarDays, Pencil, Plus } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { startPeriod, endPeriod } from '../lib/periodActions';
import { getLogByDate } from '../lib/db';
import { useApp } from '../contexts/AppContext';
import {
  FLOW_INTENSITIES,
  MOOD_LABELS,
  SYMPTOM_LABELS,
  type DailyLog,
} from '../lib/types';

function summarize(log: DailyLog): string[] {
  const chips: string[] = [];
  const flow = FLOW_INTENSITIES.find((option) => option.value === log.flow);
  if (flow) chips.push(`Blutung: ${flow.label}`);
  log.symptoms?.forEach((symptom) => chips.push(SYMPTOM_LABELS[symptom]));
  if (log.mood) chips.push(MOOD_LABELS[log.mood]);
  if (log.temperature) chips.push(`${log.temperature.toFixed(2)} °C`);
  if (log.notes) chips.push('Notiz');
  return chips;
}

export function QuickLog() {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [todayLog, setTodayLog] = useState<DailyLog | undefined>();
  const { refreshData, latestCycle, dataVersion } = useApp();
  const navigate = useNavigate();
  const today = format(new Date(), 'yyyy-MM-dd');
  const active = Boolean(latestCycle && !latestCycle.endDate);
  const openCalendar = () => navigate(`/calendar?edit=period&date=${latestCycle?.startDate ?? today}`);

  useEffect(() => {
    let cancelled = false;
    void getLogByDate(today).then((log) => {
      if (!cancelled) setTodayLog(log);
    });
    return () => { cancelled = true; };
  }, [today, dataVersion]);

  const handlePeriodAction = async () => {
    setIsSaving(true);
    setError('');
    try {
      const result = active ? await endPeriod(today, latestCycle) : await startPeriod(today, latestCycle);
      if (!result.ok) {
        setError(result.error ?? 'Die Periode konnte nicht gespeichert werden.');
        return;
      }
      await refreshData();
    } catch {
      setError('Die Periode konnte nicht gespeichert werden. Bitte versuche es erneut.');
    } finally {
      setIsSaving(false);
    }
  };

  const chips = todayLog ? summarize(todayLog) : [];
  const periodLabel = isSaving
    ? 'Speichern…'
    : active
      ? 'Periode heute beenden'
      : 'Periode heute starten';
  const PeriodIcon = active ? CheckCircle2 : Droplet;
  const logLabel = todayLog ? 'Eintrag bearbeiten' : 'Symptome eintragen';
  const LogIcon = todayLog ? Pencil : Plus;

  const primaryClass = 'w-full btn btn-primary flex items-center justify-center gap-2 py-3';
  const secondaryClass =
    'w-full btn bg-white text-primary-700 border border-primary-200 hover:bg-primary-50 flex items-center justify-center gap-2 py-3';

  const periodButton = (
    <button
      onClick={() => void handlePeriodAction()}
      disabled={isSaving}
      className={primaryClass}
    >
      <PeriodIcon className="w-5 h-5" />
      {periodLabel}
    </button>
  );
  const logButton = (
    <button
      onClick={() => navigate('/log')}
      disabled={isSaving}
      className={secondaryClass}
    >
      <LogIcon className="w-5 h-5" />
      {logLabel}
    </button>
  );

  return (
    <section className="card mt-4 p-5" aria-label="Periode erfassen">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="font-semibold text-gray-800">Deine Periode</h2>
        <span className="text-xs text-gray-500">
          {active && latestCycle
            ? `Periode seit ${format(parseISO(latestCycle.startDate), 'd. MMM', { locale: de })}`
            : format(new Date(), 'EEEE, d. MMMM', { locale: de })}
        </span>
      </div>

      <div className="space-y-2">
        {periodButton}
        {logButton}
      </div>
      {error && <p role="alert" className="text-sm text-red-600 mt-3">{error}</p>}

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {chips.map((chip) => (
            <span key={chip} className="px-2.5 py-1 rounded-full bg-sky-50 border border-sky-100 text-xs text-gray-700">
              {chip}
            </span>
          ))}
        </div>
      )}

      {(active || latestCycle?.autoEnded) && (
        <p className="text-xs text-gray-500 mt-3">
          {latestCycle?.autoEnded
            ? `Automatisch am ${format(parseISO(latestCycle.endDate!), 'd. MMM', { locale: de })} beendet. Du kannst das Datum im Kalender ändern.`
            : 'Ohne manuelles Ende wird die Periode nach 5 Tagen automatisch beendet. Der Starttag zählt mit.'}
        </p>
      )}

      <button
        onClick={openCalendar}
        disabled={isSaving}
        className="w-full flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-primary-700 min-h-[44px] mt-2 rounded-xl hover:bg-sky-50"
      >
        <CalendarDays className="w-4 h-4" />
        {latestCycle ? 'Periodendaten im Kalender korrigieren' : 'Vergangene Periode nachtragen'}
      </button>
    </section>
  );
}
