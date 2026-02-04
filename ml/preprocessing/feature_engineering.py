"""Feature engineering for cycle prediction model."""

import numpy as np
from datetime import date, timedelta
from typing import Optional

from ml.models.schemas import Cycle, DailyLog


def compute_cycle_features(cycles: list[Cycle]) -> dict:
    """Compute features from cycle history for prediction.

    Returns features useful for time series prediction:
    - Cycle lengths
    - Rolling statistics
    - Seasonality indicators
    """
    if len(cycles) < 2:
        return {"error": "Need at least 2 cycles for features"}

    sorted_cycles = sorted(cycles, key=lambda c: c.start_date)

    # Get cycle lengths (compute if not provided)
    lengths = []
    for i, cycle in enumerate(sorted_cycles[:-1]):
        if cycle.length is not None:
            lengths.append(cycle.length)
        else:
            length = (sorted_cycles[i + 1].start_date - cycle.start_date).days
            lengths.append(length)

    # Filter out physiologically implausible values
    valid_lengths = [l for l in lengths if 21 <= l <= 45]

    if len(valid_lengths) < 2:
        return {"error": "Not enough valid cycles (21-45 days)"}

    lengths_arr = np.array(valid_lengths)

    features = {
        "cycle_lengths": valid_lengths,
        "mean_length": float(np.mean(lengths_arr)),
        "std_length": float(np.std(lengths_arr)),
        "min_length": int(np.min(lengths_arr)),
        "max_length": int(np.max(lengths_arr)),
        "last_length": valid_lengths[-1],
        "n_cycles": len(valid_lengths),
    }

    # Rolling mean (last 3 cycles)
    if len(valid_lengths) >= 3:
        features["rolling_mean_3"] = float(np.mean(valid_lengths[-3:]))

    # Rolling mean (last 6 cycles)
    if len(valid_lengths) >= 6:
        features["rolling_mean_6"] = float(np.mean(valid_lengths[-6:]))

    # Trend: is cycle length increasing or decreasing?
    if len(valid_lengths) >= 4:
        recent = np.mean(valid_lengths[-3:])
        older = np.mean(valid_lengths[:-3])
        features["trend"] = float(recent - older)

    # Regularity score (inverse of coefficient of variation)
    cv = np.std(lengths_arr) / np.mean(lengths_arr)
    features["regularity_score"] = float(max(0, 1 - cv))

    # Period lengths if available
    period_lengths = [c.period_length for c in sorted_cycles if c.period_length]
    if period_lengths:
        features["avg_period_length"] = float(np.mean(period_lengths))

    # Month of last period (seasonality)
    features["last_month"] = sorted_cycles[-1].start_date.month
    features["last_start_date"] = sorted_cycles[-1].start_date.isoformat()

    return features


def compute_log_features(logs: list[DailyLog], cycles: list[Cycle]) -> dict:
    """Compute features from daily logs.

    Analyzes patterns in symptoms and mood relative to cycle phase.
    """
    if not logs or not cycles:
        return {}

    features = {}

    # Count symptom frequencies
    symptom_counts: dict[str, int] = {}
    mood_counts: dict[str, int] = {}

    for log in logs:
        for symptom in log.symptoms:
            symptom_counts[symptom] = symptom_counts.get(symptom, 0) + 1
        if log.mood:
            mood_counts[log.mood] = mood_counts.get(log.mood, 0) + 1

    features["symptom_frequencies"] = symptom_counts
    features["mood_frequencies"] = mood_counts

    # Temperature analysis if available
    temps = [log.temperature for log in logs if log.temperature]
    if len(temps) >= 10:
        features["avg_temperature"] = float(np.mean(temps))
        features["temp_std"] = float(np.std(temps))

    return features


def prepare_prophet_data(cycles: list[Cycle]) -> list[dict]:
    """Prepare data in Prophet format.

    Prophet expects a DataFrame with 'ds' (date) and 'y' (value) columns.
    For cycle prediction, we use period start dates and cycle lengths.
    """
    sorted_cycles = sorted(cycles, key=lambda c: c.start_date)
    data = []

    for i, cycle in enumerate(sorted_cycles[:-1]):
        length = cycle.length
        if length is None:
            length = (sorted_cycles[i + 1].start_date - cycle.start_date).days

        # Filter implausible values
        if 21 <= length <= 45:
            data.append({
                "ds": cycle.start_date.isoformat(),
                "y": length,
            })

    return data


def predict_fertile_window(
    last_period_start: date,
    predicted_cycle_length: int,
) -> tuple[date, date]:
    """Estimate fertile window based on cycle length.

    Ovulation typically occurs 12-16 days before the next period.
    Fertile window is approximately 5 days before ovulation + ovulation day.
    """
    # Estimate ovulation day (14 days before next period is common)
    days_before_next = 14
    next_period = last_period_start + timedelta(days=predicted_cycle_length)
    estimated_ovulation = next_period - timedelta(days=days_before_next)

    # Fertile window: 5 days before ovulation through ovulation day
    fertile_start = estimated_ovulation - timedelta(days=5)
    fertile_end = estimated_ovulation

    return fertile_start, fertile_end
