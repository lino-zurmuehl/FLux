"""Cycle prediction model with weighted-average baseline and Prophet fallback."""

from __future__ import annotations

import json
from datetime import datetime, timedelta
from pathlib import Path
from statistics import mean, pstdev

from ml.models.schemas import Cycle, ModelParams, Prediction
from ml.preprocessing.feature_engineering import predict_fertile_window, prepare_prophet_data


class CyclePredictor:
    """Predict next period date from cycle history."""

    SUPPORTED_MODELS = {"auto", "prophet", "weighted_average"}

    def __init__(self, model_type: str = "auto"):
        if model_type not in self.SUPPORTED_MODELS:
            raise ValueError(f"Unsupported model type: {model_type}")
        self.requested_model_type = model_type
        self.model_type = "weighted_average"

        self._fitted = False
        self._cycles: list[Cycle] = []
        self._valid_lengths: list[int] = []
        self._prediction: Prediction | None = None
        self._avg_cycle_length = 0.0
        self._std_cycle_length = 0.0
        self._avg_period_length: float | None = None
        self._trend: float | None = None

    @staticmethod
    def _compute_cycle_lengths(cycles: list[Cycle]) -> list[int]:
        """Build valid cycle lengths and filter implausible values."""
        sorted_cycles = sorted(cycles, key=lambda c: c.start_date)
        lengths: list[int] = []

        for idx, cycle in enumerate(sorted_cycles[:-1]):
            length = cycle.length
            if length is None:
                length = (sorted_cycles[idx + 1].start_date - cycle.start_date).days
            if 21 <= int(length) <= 45:
                lengths.append(int(length))

        return lengths

    @staticmethod
    def _weighted_average(lengths: list[int]) -> int:
        """Compute recency-weighted average cycle length."""
        weights = list(range(1, len(lengths) + 1))
        weighted_sum = sum(length * weight for length, weight in zip(lengths, weights))
        return round(weighted_sum / sum(weights))

    @staticmethod
    def _compute_trend(lengths: list[int]) -> float | None:
        if len(lengths) < 4:
            return None
        recent = mean(lengths[-3:])
        older = mean(lengths[:-3])
        return recent - older

    @staticmethod
    def _compute_confidence(lengths: list[int]) -> float:
        """Estimate confidence from cycle consistency and history size."""
        avg = mean(lengths)
        std = pstdev(lengths) if len(lengths) > 1 else 0.0
        cv = std / avg if avg else 1.0

        consistency = 1.0 - min(1.0, cv * 2.2)
        history_bonus = min(0.12, len(lengths) * 0.02)
        confidence = max(0.15, min(0.95, consistency + history_bonus))
        return round(confidence, 2)

    def _try_prophet(self) -> int | None:
        """Try Prophet prediction when available; returns None on fallback."""
        try:
            import pandas as pd
            from prophet import Prophet
        except ImportError:
            return None

        rows = prepare_prophet_data(self._cycles)

        if len(rows) < 4:
            return None

        try:
            frame = pd.DataFrame(rows)
            frame["ds"] = pd.to_datetime(frame["ds"])
            model = Prophet(
                daily_seasonality=False,
                weekly_seasonality=False,
                yearly_seasonality=False,
            )
            model.fit(frame)

            baseline_days = self._weighted_average(self._valid_lengths)
            target_date = self._cycles[-1].start_date + timedelta(days=baseline_days)
            future = pd.DataFrame({"ds": [pd.Timestamp(target_date)]})
            forecast = model.predict(future)
            predicted = int(round(float(forecast["yhat"].iloc[0])))
            return max(21, min(45, predicted))
        except Exception:
            return None

    def fit(self, cycles: list[Cycle]) -> None:
        """Fit model on cycle history."""
        if len(cycles) < 3:
            raise ValueError("Need at least 3 cycles for meaningful predictions")

        self._cycles = sorted(cycles, key=lambda c: c.start_date)
        self._valid_lengths = self._compute_cycle_lengths(self._cycles)

        if len(self._valid_lengths) < 3:
            raise ValueError("Need at least 3 cycles for meaningful predictions")

        self._avg_cycle_length = mean(self._valid_lengths)
        self._std_cycle_length = pstdev(self._valid_lengths) if len(self._valid_lengths) > 1 else 0.0

        period_lengths = [c.period_length for c in self._cycles if c.period_length]
        self._avg_period_length = mean(period_lengths) if period_lengths else None
        self._trend = self._compute_trend(self._valid_lengths)

        predicted_length: int | None = None
        selected_model = "weighted_average"

        if self.requested_model_type in {"auto", "prophet"}:
            predicted_length = self._try_prophet()
            if predicted_length is not None:
                selected_model = "prophet"

        if predicted_length is None:
            if self.requested_model_type == "prophet":
                raise ValueError(
                    "Prophet model requested but unavailable. Install optional ML deps with: "
                    "pip install -e '.[ml]'"
                )
            predicted_length = self._weighted_average(self._valid_lengths)

        confidence = self._compute_confidence(self._valid_lengths)
        last_period_start = self._cycles[-1].start_date
        fertile_start, fertile_end = predict_fertile_window(last_period_start, predicted_length)
        next_period_date = last_period_start + timedelta(days=predicted_length)

        self.model_type = selected_model
        self._prediction = Prediction(
            next_period_date=next_period_date,
            confidence=confidence,
            expected_cycle_length=predicted_length,
            fertile_window_start=fertile_start,
            fertile_window_end=fertile_end,
            period_length=round(self._avg_period_length) if self._avg_period_length else None,
        )
        self._fitted = True

    def predict(self) -> Prediction:
        """Return prediction from the fitted model."""
        if not self._fitted or self._prediction is None:
            raise ValueError("Model is not fitted. Call fit() first.")
        return self._prediction

    def export_params(self) -> ModelParams:
        """Build serializable model parameters for the frontend import."""
        prediction = self.predict()
        return ModelParams(
            trained_at=datetime.now(),
            cycles_trained=len(self._cycles),
            model_type=self.model_type,
            prediction=prediction,
            avg_cycle_length=self._avg_cycle_length,
            std_cycle_length=self._std_cycle_length,
            avg_period_length=self._avg_period_length,
            recent_cycle_lengths=self._valid_lengths[-6:],
            trend=self._trend,
            seasonality=None,
        )

    def save(self, output_path: str | Path) -> None:
        """Save model parameters as JSON."""
        params = self.export_params()
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        with open(output_file, "w", encoding="utf-8") as handle:
            json.dump(params.to_dict(), handle, indent=2)
