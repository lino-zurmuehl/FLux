/**
 * Schnellaktion zum Erfassen des Periodenstarts/-endes.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Droplet, CheckCircle2, Plus, Calendar, X, Pencil } from 'lucide-react';
import { format, differenceInCalendarDays, subDays } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  addCycle,
  deleteCycle,
  getAllCycles,
  getCycleByStartDate,
  updateCycle,
  updatePredictionForNewCycle,
} from '../lib/db';
import { useApp } from '../contexts/AppContext';

export function QuickLog() {
  const [isLogging, setIsLogging] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCorrection, setShowCorrection] = useState(false);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [correctedStartDate, setCorrectedStartDate] = useState('');
  const [correctedEndDate, setCorrectedEndDate] = useState('');
  const [isCorrecting, setIsCorrecting] = useState(false);
  const { refreshData, latestCycle } = useApp();
  const navigate = useNavigate();

  // Period is active until the latest cycle gets an end date.
  const isPeriodActive =
    latestCycle &&
    !latestCycle.endDate;

  useEffect(() => {
    if (latestCycle?.startDate) {
      setCorrectedStartDate(latestCycle.startDate);
      setCorrectedEndDate(latestCycle.endDate ?? format(new Date(), 'yyyy-MM-dd'));
    } else {
      setCorrectedStartDate('');
      setCorrectedEndDate('');
    }
  }, [latestCycle?.id, latestCycle?.startDate, latestCycle?.endDate]);

  const handlePeriodStart = async (date: string) => {
    if (latestCycle && !latestCycle.endDate) {
      alert('Beende zuerst die laufende Periode.');
      return;
    }
    if (latestCycle && date <= latestCycle.startDate) {
      alert('Der neue Periodenstart muss nach dem letzten Startdatum liegen.');
      return;
    }

    setIsLogging(true);
    try {
      const existing = await getCycleByStartDate(date);
      if (existing) {
        alert('Für dieses Datum existiert bereits ein Periodenstart.');
        return;
      }
      await addCycle({ startDate: date });
      await updatePredictionForNewCycle(date);
      await refreshData();
      setShowDatePicker(false);
    } catch (error) {
      console.error('Fehler beim Erfassen:', error);
    } finally {
      setIsLogging(false);
    }
  };

  const handlePeriodEnd = async (date: string) => {
    if (!latestCycle?.id) return;

    if (date < latestCycle.startDate) {
      alert('Das Enddatum kann nicht vor dem Startdatum liegen.');
      return;
    }

    setIsLogging(true);
    try {
      const periodLength = differenceInCalendarDays(
        new Date(date),
        new Date(latestCycle.startDate)
      ) + 1;

      await updateCycle(latestCycle.id, {
        endDate: date,
        periodLength,
      });
      await refreshData();
      setShowDatePicker(false);
    } catch (error) {
      console.error('Fehler beim Erfassen:', error);
    } finally {
      setIsLogging(false);
    }
  };

  const handleQuickAction = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    if (isPeriodActive) {
      handlePeriodEnd(today);
    } else {
      handlePeriodStart(today);
    }
  };

  const handleDateSubmit = () => {
    if (isPeriodActive) {
      handlePeriodEnd(selectedDate);
    } else {
      handlePeriodStart(selectedDate);
    }
  };

  const handleCorrectStartDate = async () => {
    if (!latestCycle?.id || !correctedStartDate) return;

    setIsCorrecting(true);
    try {
      const allCycles = await getAllCycles();
      const index = allCycles.findIndex((c) => c.id === latestCycle.id);
      const previousCycle = index > 0 ? allCycles[index - 1] : undefined;

      if (previousCycle && correctedStartDate <= previousCycle.startDate) {
        alert('Startdatum muss nach dem vorherigen Zyklusstart liegen.');
        return;
      }
      if (latestCycle.endDate && correctedStartDate > latestCycle.endDate) {
        alert('Startdatum kann nicht nach dem Enddatum liegen.');
        return;
      }

      const updates: { startDate: string; periodLength?: number } = { startDate: correctedStartDate };
      if (latestCycle.endDate) {
        updates.periodLength =
          differenceInCalendarDays(new Date(latestCycle.endDate), new Date(correctedStartDate)) + 1;
      }

      await updateCycle(latestCycle.id, updates);
      await updatePredictionForNewCycle(correctedStartDate);
      await refreshData();
    } catch (error) {
      console.error('Korrektur fehlgeschlagen:', error);
    } finally {
      setIsCorrecting(false);
    }
  };

  const handleCorrectEndDate = async () => {
    if (!latestCycle?.id || !correctedEndDate) return;
    if (correctedEndDate < latestCycle.startDate) {
      alert('Enddatum kann nicht vor dem Startdatum liegen.');
      return;
    }

    setIsCorrecting(true);
    try {
      const periodLength =
        differenceInCalendarDays(new Date(correctedEndDate), new Date(latestCycle.startDate)) + 1;

      await updateCycle(latestCycle.id, {
        endDate: correctedEndDate,
        periodLength,
      });
      await refreshData();
    } catch (error) {
      console.error('Korrektur fehlgeschlagen:', error);
    } finally {
      setIsCorrecting(false);
    }
  };

  const handleUndoEndDate = async () => {
    if (!latestCycle?.id || !latestCycle.endDate) return;

    setIsCorrecting(true);
    try {
      await updateCycle(latestCycle.id, {
        endDate: undefined,
        periodLength: undefined,
      });
      await refreshData();
    } catch (error) {
      console.error('Rückgängig fehlgeschlagen:', error);
    } finally {
      setIsCorrecting(false);
    }
  };

  const handleUndoStart = async () => {
    if (!latestCycle?.id) return;

    setIsCorrecting(true);
    try {
      const allCycles = await getAllCycles();
      const previousCycleStart = allCycles.length > 1 ? allCycles[allCycles.length - 2].startDate : null;

      await deleteCycle(latestCycle.id);
      if (previousCycleStart) {
        await updatePredictionForNewCycle(previousCycleStart);
      }
      await refreshData();
    } catch (error) {
      console.error('Rückgängig fehlgeschlagen:', error);
    } finally {
      setIsCorrecting(false);
    }
  };

  // Generate last 14 days for quick selection
  const recentDays = Array.from({ length: 14 }, (_, i) => {
    const date = subDays(new Date(), i);
    return {
      value: format(date, 'yyyy-MM-dd'),
      label: i === 0 ? 'Heute' : i === 1 ? 'Gestern' : format(date, 'd. MMM', { locale: de }),
      dayOfWeek: format(date, 'EEE', { locale: de }),
    };
  });

  return (
    <div className="card mt-4">
      <h3 className="font-medium text-gray-700 mb-3">Schnellaktionen</h3>

      <div className="flex gap-3">
        {isPeriodActive ? (
          <button
            onClick={handleQuickAction}
            disabled={isLogging}
            className="flex-1 btn bg-sky-100 text-sky-700 hover:bg-sky-200 flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>{isLogging ? 'Erfasse...' : 'Periode beendet'}</span>
          </button>
        ) : (
          <button
            onClick={handleQuickAction}
            disabled={isLogging}
            className="flex-1 btn bg-primary-100 text-primary-700 hover:bg-primary-200 flex items-center justify-center gap-2"
          >
            <Droplet className="w-5 h-5" />
            <span>{isLogging ? 'Erfasse...' : 'Periode gestartet'}</span>
          </button>
        )}

        <button
          onClick={() => {
            setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
            setShowDatePicker(!showDatePicker);
          }}
          className="btn bg-gray-100 text-gray-700 hover:bg-gray-200 px-3"
          title="Anderes Datum wählen"
        >
          <Calendar className="w-5 h-5" />
        </button>

        <button
          onClick={() => navigate('/log')}
          className="flex-1 btn btn-secondary flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          <span>Eintrag</span>
        </button>
      </div>

      {/* Date Picker Overlay */}
      {showDatePicker && (
        <div className="mt-4 p-4 bg-sky-50 rounded-lg border border-sky-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-700">
              {isPeriodActive ? 'Wann endete die Periode?' : 'Wann startete die Periode?'}
            </h4>
            <button
              onClick={() => setShowDatePicker(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick date buttons */}
          <div className="grid grid-cols-7 gap-1 mb-3">
            {recentDays.slice(0, 7).map((day) => (
              <button
                key={day.value}
                onClick={() => setSelectedDate(day.value)}
                className={`p-2 text-center rounded text-sm transition-colors ${
                  selectedDate === day.value
                    ? 'bg-primary-600 text-white'
                    : 'bg-white hover:bg-primary-100'
                }`}
              >
                <div className="text-xs opacity-75">{day.dayOfWeek}</div>
                <div className="font-medium">{day.label.split(' ')[0]}</div>
              </button>
            ))}
          </div>

          {/* Show more days */}
          <details className="mb-3">
            <summary className="text-sm text-primary-600 cursor-pointer hover:underline">
              Weitere Tage anzeigen
            </summary>
            <div className="grid grid-cols-7 gap-1 mt-2">
              {recentDays.slice(7).map((day) => (
                <button
                  key={day.value}
                  onClick={() => setSelectedDate(day.value)}
                  className={`p-2 text-center rounded text-sm transition-colors ${
                    selectedDate === day.value
                      ? 'bg-primary-600 text-white'
                      : 'bg-white hover:bg-primary-100'
                  }`}
                >
                  <div className="text-xs opacity-75">{day.dayOfWeek}</div>
                  <div className="font-medium">{day.label.split(' ')[0]}</div>
                </button>
              ))}
            </div>
          </details>

          {/* Manual date input */}
          <div className="flex gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={format(new Date(), 'yyyy-MM-dd')}
              className="flex-1 input text-sm"
            />
            <button
              onClick={handleDateSubmit}
              disabled={isLogging}
              className="btn btn-primary"
            >
              {isLogging ? 'Erfasse...' : 'Speichern'}
            </button>
          </div>
        </div>
      )}

      {/* Correction panel for accidental clicks */}
      {latestCycle && (
        <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
          <button
            onClick={() => setShowCorrection((v) => !v)}
            className="w-full flex items-center justify-center gap-2 text-amber-800 font-medium"
          >
            <Pencil className="w-4 h-4" />
            {showCorrection ? 'Korrektur schließen' : 'Start/Ende korrigieren'}
          </button>

          {showCorrection && (
            <div className="mt-3 space-y-3 text-sm">
              <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
                <div>
                  <label className="label mb-1">Startdatum korrigieren</label>
                  <input
                    type="date"
                    value={correctedStartDate}
                    onChange={(e) => setCorrectedStartDate(e.target.value)}
                    max={format(new Date(), 'yyyy-MM-dd')}
                    className="input text-sm"
                  />
                </div>
                <button
                  onClick={handleCorrectStartDate}
                  disabled={isCorrecting || !correctedStartDate}
                  className="btn btn-secondary"
                >
                  Speichern
                </button>
              </div>

              <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
                <div>
                  <label className="label mb-1">Enddatum korrigieren</label>
                  <input
                    type="date"
                    value={correctedEndDate}
                    onChange={(e) => setCorrectedEndDate(e.target.value)}
                    min={latestCycle.startDate}
                    max={format(new Date(), 'yyyy-MM-dd')}
                    className="input text-sm"
                  />
                </div>
                <button
                  onClick={handleCorrectEndDate}
                  disabled={isCorrecting || !correctedEndDate}
                  className="btn btn-secondary"
                >
                  Speichern
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleUndoEndDate}
                  disabled={isCorrecting || !latestCycle.endDate}
                  className="btn bg-sky-100 text-sky-700 hover:bg-sky-200 flex-1"
                >
                  Ende rückgängig
                </button>
                <button
                  onClick={handleUndoStart}
                  disabled={isCorrecting || !!latestCycle.endDate}
                  className="btn bg-red-100 text-red-700 hover:bg-red-200 flex-1"
                >
                  Start rückgängig
                </button>
              </div>

              <p className="text-xs text-amber-700">
                `Start rückgängig` ist nur möglich, solange noch kein Enddatum gesetzt wurde.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
