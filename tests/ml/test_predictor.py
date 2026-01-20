"""Tests for the cycle prediction model."""

import pytest
from datetime import date, timedelta

from backend.models.schemas import CycleData
from ml.models.cycle_predictor import CyclePredictor


def create_test_cycles(start_date: date, lengths: list[int]) -> list[CycleData]:
    """Create test cycle data with specified lengths."""
    cycles = []
    current = start_date

    for length in lengths:
        cycles.append(CycleData(start_date=current))
        current = current + timedelta(days=length)

    # Add the last cycle start
    cycles.append(CycleData(start_date=current))
    return cycles


class TestCyclePredictor:
    def test_predict_insufficient_data(self):
        predictor = CyclePredictor()
        cycles = [CycleData(start_date=date(2024, 1, 1))]

        result = predictor.predict(cycles)

        assert result.predicted_start is None
        assert result.confidence == 0.0

    def test_predict_regular_cycles(self):
        predictor = CyclePredictor()
        # Regular 28-day cycles
        cycles = create_test_cycles(date(2024, 1, 1), [28, 28, 28, 28])

        result = predictor.predict(cycles)

        assert result.predicted_start is not None
        assert result.cycle_length_avg == 28
        assert result.confidence > 0.8  # High confidence for regular cycles

    def test_predict_irregular_cycles(self):
        predictor = CyclePredictor()
        # Irregular cycles
        cycles = create_test_cycles(date(2024, 1, 1), [25, 32, 27, 35])

        result = predictor.predict(cycles)

        assert result.predicted_start is not None
        assert result.confidence < 0.7  # Lower confidence for irregular

    def test_filters_outliers(self):
        predictor = CyclePredictor()
        # Include an outlier (50 days) that should be filtered
        cycles = create_test_cycles(date(2024, 1, 1), [28, 28, 50, 28])

        result = predictor.predict(cycles)

        # The 50-day outlier should be filtered (>45 days)
        assert 26 <= result.cycle_length_avg <= 30
