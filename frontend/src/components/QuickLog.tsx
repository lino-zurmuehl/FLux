/**
 * Schnellaktion zum Erfassen des Periodenstarts/-endes.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Droplet, CheckCircle2, Plus } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { addCycle, updateCycle, updatePredictionForNewCycle } from '../lib/db';
import { useApp } from '../contexts/AppContext';

export function QuickLog() {
  const [isLogging, setIsLogging] = useState(false);
  const { refreshData, latestCycle, currentCycleDay } = useApp();
  const navigate = useNavigate();

  // Check if period is currently active (started but not ended, within first 10 days)
  const isPeriodActive =
    latestCycle &&
    !latestCycle.endDate &&
    currentCycleDay !== null &&
    currentCycleDay <= 10;

  const handlePeriodStart = async () => {
    setIsLogging(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      await addCycle({ startDate: today });
      await updatePredictionForNewCycle(today);
      await refreshData();
    } catch (error) {
      console.error('Fehler beim Erfassen:', error);
    } finally {
      setIsLogging(false);
    }
  };

  const handlePeriodEnd = async () => {
    if (!latestCycle?.id) return;

    setIsLogging(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const periodLength = differenceInDays(
        new Date(today),
        new Date(latestCycle.startDate)
      ) + 1;

      await updateCycle(latestCycle.id, {
        endDate: today,
        periodLength,
      });
      await refreshData();
    } catch (error) {
      console.error('Fehler beim Erfassen:', error);
    } finally {
      setIsLogging(false);
    }
  };

  return (
    <div className="card mt-4">
      <h3 className="font-medium text-gray-700 mb-3">Schnellaktionen</h3>

      <div className="flex gap-3">
        {isPeriodActive ? (
          <button
            onClick={handlePeriodEnd}
            disabled={isLogging}
            className="flex-1 btn bg-sky-100 text-sky-700 hover:bg-sky-200 flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>{isLogging ? 'Erfasse...' : 'Periode beendet'}</span>
          </button>
        ) : (
          <button
            onClick={handlePeriodStart}
            disabled={isLogging}
            className="flex-1 btn bg-primary-100 text-primary-700 hover:bg-primary-200 flex items-center justify-center gap-2"
          >
            <Droplet className="w-5 h-5" />
            <span>{isLogging ? 'Erfasse...' : 'Periode gestartet'}</span>
          </button>
        )}

        <button
          onClick={() => navigate('/log')}
          className="flex-1 btn btn-secondary flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          <span>Eintrag</span>
        </button>
      </div>
    </div>
  );
}
