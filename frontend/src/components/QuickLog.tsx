/**
 * Schnellaktion zum Erfassen des Periodenstarts.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Droplet, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { addCycle } from '../lib/db';
import { useApp } from '../contexts/AppContext';

export function QuickLog() {
  const [isLogging, setIsLogging] = useState(false);
  const { refreshData } = useApp();
  const navigate = useNavigate();

  const handlePeriodStart = async () => {
    setIsLogging(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      await addCycle({ startDate: today });
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
        <button
          onClick={handlePeriodStart}
          disabled={isLogging}
          className="flex-1 btn bg-primary-100 text-primary-700 hover:bg-primary-200 flex items-center justify-center gap-2"
        >
          <Droplet className="w-5 h-5" />
          <span>{isLogging ? 'Erfasse...' : 'Periode gestartet'}</span>
        </button>

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
