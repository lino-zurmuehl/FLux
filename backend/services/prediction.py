"""Prediction service - interfaces with ML model."""

from datetime import date, timedelta
from typing import Optional

from backend.api.schemas import CycleData, PredictionResponse


class PredictionService:
    """Service for period predictions using time series model."""

    def __init__(self, model_path: Optional[str] = None):
        self.model = None
        if model_path:
            self.load_model(model_path)

    def load_model(self, model_path: str):
        """Load trained prediction model."""
        # TODO: Load actual model
        pass

    def predict(self, cycles: list[CycleData]) -> PredictionResponse:
        """Predict next period based on cycle history."""
        if not cycles:
            return PredictionResponse(
                predicted_start=None,
                confidence=0.0,
                cycle_length_avg=0,
            )

        # Simple baseline: average cycle length
        cycle_lengths = []
        sorted_cycles = sorted(cycles, key=lambda c: c.start_date)

        for i in range(1, len(sorted_cycles)):
            length = (sorted_cycles[i].start_date - sorted_cycles[i-1].start_date).days
            if 21 <= length <= 35:  # Filter outliers
                cycle_lengths.append(length)

        if not cycle_lengths:
            return PredictionResponse(
                predicted_start=None,
                confidence=0.0,
                cycle_length_avg=28,
            )

        avg_length = round(sum(cycle_lengths) / len(cycle_lengths))
        last_start = sorted_cycles[-1].start_date
        predicted_start = last_start + timedelta(days=avg_length)

        # Confidence based on consistency
        if len(cycle_lengths) >= 3:
            variance = sum((l - avg_length) ** 2 for l in cycle_lengths) / len(cycle_lengths)
            confidence = max(0.0, min(1.0, 1.0 - (variance / 50)))
        else:
            confidence = 0.3

        return PredictionResponse(
            predicted_start=predicted_start,
            confidence=round(confidence, 2),
            cycle_length_avg=avg_length,
        )
