interface Prediction {
  predicted_start: string | null;
  confidence: number;
  cycle_length_avg: number;
}

interface Props {
  prediction: Prediction | null;
}

export function PredictionCard({ prediction }: Props) {
  if (!prediction || !prediction.predicted_start) {
    return (
      <div className="prediction-card empty">
        <h2>Next Period</h2>
        <p>Not enough data for prediction. Add more cycles to improve accuracy.</p>
      </div>
    );
  }

  const confidencePercent = Math.round(prediction.confidence * 100);

  return (
    <div className="prediction-card">
      <h2>Next Period</h2>
      <p className="predicted-date">{prediction.predicted_start}</p>
      <p className="confidence">Confidence: {confidencePercent}%</p>
      <p className="avg-cycle">Average cycle: {prediction.cycle_length_avg} days</p>
    </div>
  );
}
