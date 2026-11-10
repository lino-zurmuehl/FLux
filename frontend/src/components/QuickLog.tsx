/** Primary home action: period start/end, with corrections in the calendar. */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Droplet, CheckCircle2, CalendarDays, Pencil } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { startPeriod, endPeriod } from '../lib/periodActions';
import { useApp } from '../contexts/AppContext';

export function QuickLog() {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const { refreshData, latestCycle } = useApp();
  const navigate = useNavigate();
  const active = Boolean(latestCycle && !latestCycle.endDate);
  const openCalendar = () => navigate(`/calendar?edit=period&date=${latestCycle?.startDate ?? format(new Date(), 'yyyy-MM-dd')}`);

  const handleAction = async () => {
    setIsSaving(true);
    setError('');
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
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

  return (
    <section className="card mt-4" aria-label="Periode erfassen">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-800">Deine Periode</h2>
        {latestCycle && (
          <span className="text-xs text-gray-500">
            {active ? `Seit ${format(parseISO(latestCycle.startDate), 'd. MMM', { locale: de })}` : 'Beendet'}
          </span>
        )}
      </div>
      <button onClick={() => void handleAction()} disabled={isSaving} className="w-full btn btn-primary flex items-center justify-center gap-2 py-3">
        {active ? <CheckCircle2 className="w-5 h-5" /> : <Droplet className="w-5 h-5" />}
        {isSaving ? 'Speichern…' : active ? 'Periode heute beenden' : 'Periode heute starten'}
      </button>
      {error && <p role="alert" className="text-sm text-red-600 mt-3">{error}</p>}
      <button onClick={openCalendar} disabled={isSaving} className="w-full flex items-center justify-center gap-2 text-sm text-primary-700 py-3 mt-1 rounded-xl hover:bg-primary-50">
        <CalendarDays className="w-4 h-4" />
        {latestCycle ? 'Daten im Kalender korrigieren' : 'Vergangene Periode nachtragen'}
      </button>
      <p className="text-xs text-gray-500">
        {latestCycle?.autoEnded
          ? `Automatisch am ${format(parseISO(latestCycle.endDate!), 'd. MMM', { locale: de })} beendet. Du kannst das Datum im Kalender ändern.`
          : 'Ohne manuelles Ende wird die Periode nach 5 Tagen automatisch beendet. Der Starttag zählt mit.'}
      </p>
      <div className="border-t border-sky-100 mt-4 pt-3">
        <button onClick={() => navigate('/log')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary-700 py-1">
          <Pencil className="w-4 h-4" /> Symptome oder Notizen erfassen
        </button>
      </div>
    </section>
  );
}
