import { useState, useEffect } from 'react';

interface Cycle {
  start_date: string;
  end_date: string | null;
}

export function CycleCalendar() {
  const [cycles, setCycles] = useState<Cycle[]>([]);

  useEffect(() => {
    fetchCycles();
  }, []);

  async function fetchCycles() {
    try {
      const response = await fetch('/api/v1/cycles');
      const data = await response.json();
      setCycles(data.cycles || []);
    } catch (error) {
      console.error('Failed to fetch cycles:', error);
    }
  }

  return (
    <div className="cycle-calendar">
      <h2>Cycle History</h2>
      {cycles.length === 0 ? (
        <p>No cycles recorded yet. Import your data to get started.</p>
      ) : (
        <ul>
          {cycles.map((cycle, i) => (
            <li key={i}>
              {cycle.start_date}
              {cycle.end_date && ` - ${cycle.end_date}`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
