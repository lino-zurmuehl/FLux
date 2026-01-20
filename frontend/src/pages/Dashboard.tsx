import { useState, useEffect } from 'react';
import { CycleCalendar } from '../components/CycleCalendar';
import { PredictionCard } from '../components/PredictionCard';

interface Prediction {
  predicted_start: string | null;
  confidence: number;
  cycle_length_avg: number;
}

export function Dashboard() {
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPrediction();
  }, []);

  async function fetchPrediction() {
    try {
      const response = await fetch('/api/v1/predict');
      const data = await response.json();
      setPrediction(data);
    } catch (error) {
      console.error('Failed to fetch prediction:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dashboard">
      <h1>FLux</h1>
      <p className="privacy-notice">
        Your data is encrypted and stored locally. We cannot see your information.
      </p>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <>
          <PredictionCard prediction={prediction} />
          <CycleCalendar />
        </>
      )}
    </div>
  );
}
