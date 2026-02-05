/**
 * Schnellaktion zum Erfassen des Periodenstarts/-endes.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Droplet, CheckCircle2, Plus, Calendar, X } from 'lucide-react';
import { format, differenceInDays, subDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { addCycle, updateCycle, updatePredictionForNewCycle } from '../lib/db';
import { useApp } from '../contexts/AppContext';

export function QuickLog() {
  const [isLogging, setIsLogging] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const { refreshData, latestCycle, currentCycleDay } = useApp();
  const navigate = useNavigate();

  // Check if period is currently active (started but not ended, within first 10 days)
  const isPeriodActive =
    latestCycle &&
    !latestCycle.endDate &&
    currentCycleDay !== null &&
    currentCycleDay <= 10;

  const handlePeriodStart = async (date: string) => {
    setIsLogging(true);
    try {
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

    setIsLogging(true);
    try {
      const periodLength = differenceInDays(
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
    </div>
  );
}
