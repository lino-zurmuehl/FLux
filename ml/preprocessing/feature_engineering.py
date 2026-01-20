"""Feature engineering for cycle prediction model."""

import numpy as np
from datetime import date
from typing import Optional

from backend.models.schemas import CycleData


def compute_cycle_features(cycles: list[CycleData]) -> dict:
    """Compute features from cycle history for prediction.

    Returns features useful for time series prediction:
    - Cycle lengths
    - Rolling statistics
    - Seasonality indicators
    """
    if len(cycles) < 2:
        return {"error": "Need at least 2 cycles for features"}

    sorted_cycles = sorted(cycles, key=lambda c: c.start_date)

    # Compute cycle lengths
    lengths = []
    for i in range(1, len(sorted_cycles)):
        length = (sorted_cycles[i].start_date - sorted_cycles[i-1].start_date).days
        lengths.append(length)

    lengths = np.array(lengths)

    features = {
        "cycle_lengths": lengths.tolist(),
        "mean_length": float(np.mean(lengths)),
        "std_length": float(np.std(lengths)),
        "min_length": int(np.min(lengths)),
        "max_length": int(np.max(lengths)),
        "last_length": int(lengths[-1]) if len(lengths) > 0 else None,
        "n_cycles": len(lengths),
    }

    # Rolling mean (last 3 cycles)
    if len(lengths) >= 3:
        features["rolling_mean_3"] = float(np.mean(lengths[-3:]))

    # Rolling mean (last 6 cycles)
    if len(lengths) >= 6:
        features["rolling_mean_6"] = float(np.mean(lengths[-6:]))

    # Month of last period (seasonality)
    features["last_month"] = sorted_cycles[-1].start_date.month

    return features


def prepare_sequence_data(
    cycles: list[CycleData],
    sequence_length: int = 6,
) -> tuple[np.ndarray, np.ndarray]:
    """Prepare sequence data for LSTM/time series model.

    Args:
        cycles: List of cycle data
        sequence_length: Number of past cycles to use for prediction

    Returns:
        X: Input sequences (n_samples, sequence_length, n_features)
        y: Target values (next cycle length)
    """
    sorted_cycles = sorted(cycles, key=lambda c: c.start_date)

    # Compute lengths
    lengths = []
    for i in range(1, len(sorted_cycles)):
        length = (sorted_cycles[i].start_date - sorted_cycles[i-1].start_date).days
        lengths.append(length)

    if len(lengths) < sequence_length + 1:
        return np.array([]), np.array([])

    # Create sequences
    X, y = [], []
    for i in range(len(lengths) - sequence_length):
        X.append(lengths[i:i + sequence_length])
        y.append(lengths[i + sequence_length])

    return np.array(X), np.array(y)
