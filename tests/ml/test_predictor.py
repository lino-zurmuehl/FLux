"""Tests for the cycle prediction model."""

import pytest
from datetime import date, timedelta

from ml.models.schemas import Cycle
from ml.models.cycle_predictor import CyclePredictor


def create_test_cycles(start_date: date, lengths: list[int]) -> list[Cycle]:
    """Create test cycle data with specified lengths."""
    cycles = []
    current = start_date

    for i, length in enumerate(lengths):
        cycles.append(Cycle(start_date=current, length=length))
        current = current + timedelta(days=length)

    # Add the last cycle start (without known length yet)
    cycles.append(Cycle(start_date=current))
    return cycles


class TestCyclePredictor:
    def test_predict_insufficient_data(self):
        """Should raise error with insufficient data."""
        predictor = CyclePredictor(model_type="weighted_average")
        cycles = [Cycle(start_date=date(2024, 1, 1))]

        with pytest.raises(ValueError, match="at least 3 cycles"):
            predictor.fit(cycles)

    def test_predict_regular_cycles(self):
        """Should predict accurately for regular cycles."""
        predictor = CyclePredictor(model_type="weighted_average")
        # Regular 28-day cycles
        cycles = create_test_cycles(date(2024, 1, 1), [28, 28, 28, 28, 28])

        predictor.fit(cycles)
        result = predictor.predict()

        assert result.next_period_date is not None
        assert result.expected_cycle_length == 28
        assert result.confidence > 0.7  # High confidence for regular cycles

    def test_predict_irregular_cycles(self):
        """Should have lower confidence for highly irregular cycles."""
        predictor = CyclePredictor(model_type="weighted_average")
        # Very irregular cycles
        cycles = create_test_cycles(date(2024, 1, 1), [22, 38, 24, 40, 26])

        predictor.fit(cycles)
        result = predictor.predict()

        assert result.next_period_date is not None
        # Highly irregular cycles should have lower confidence
        assert result.confidence < 0.8

    def test_filters_outliers(self):
        """Should filter physiologically implausible values."""
        predictor = CyclePredictor(model_type="weighted_average")
        # Include outliers (15 and 50 days) that should be filtered
        cycles = create_test_cycles(date(2024, 1, 1), [28, 15, 28, 50, 28, 29])

        predictor.fit(cycles)
        result = predictor.predict()

        # Only valid cycles (21-45 days) should be used
        # 28, 28, 28, 29 are valid -> avg ~28
        assert 26 <= result.expected_cycle_length <= 30

    def test_weighted_average_favors_recent(self):
        """Weighted average should favor more recent cycles."""
        predictor = CyclePredictor(model_type="weighted_average")
        # Old cycles were 35 days, recent cycles are 28 days
        cycles = create_test_cycles(date(2024, 1, 1), [35, 35, 35, 28, 28, 28])

        predictor.fit(cycles)
        result = predictor.predict()

        # Should be closer to 28 than 35 due to recency weighting
        assert result.expected_cycle_length <= 31

    def test_export_params(self):
        """Should export model parameters correctly."""
        predictor = CyclePredictor(model_type="weighted_average")
        cycles = create_test_cycles(date(2024, 1, 1), [28, 29, 28, 27, 28])

        predictor.fit(cycles)
        params = predictor.export_params()

        assert params.cycles_trained == len(cycles)
        assert params.model_type == "weighted_average"
        assert params.prediction is not None
        assert 27 <= params.avg_cycle_length <= 29
        assert len(params.recent_cycle_lengths) > 0

    def test_fertile_window_calculation(self):
        """Should calculate fertile window."""
        predictor = CyclePredictor(model_type="weighted_average")
        cycles = create_test_cycles(date(2024, 1, 1), [28, 28, 28, 28, 28])

        predictor.fit(cycles)
        result = predictor.predict()

        assert result.fertile_window_start is not None
        assert result.fertile_window_end is not None
        # Fertile window should be before next period
        assert result.fertile_window_end < result.next_period_date
        # Fertile window typically ~5 days
        window_length = (result.fertile_window_end - result.fertile_window_start).days
        assert 4 <= window_length <= 6


class TestFloParser:
    def test_parse_sample_export(self):
        """Should parse sample Flo export correctly."""
        from ml.preprocessing.flo_parser import parse_flo_export
        from pathlib import Path

        test_file = Path(__file__).parent.parent.parent / "data" / "test" / "sample_flo_export.json"
        if not test_file.exists():
            pytest.skip("Sample test file not found")

        cycles, logs = parse_flo_export(test_file)

        assert len(cycles) >= 3
        assert all(c.start_date is not None for c in cycles)
        # Should have computed cycle lengths
        assert any(c.length is not None for c in cycles[:-1])


class TestFeatureEngineering:
    def test_compute_features(self):
        """Should compute cycle features correctly."""
        from ml.preprocessing.feature_engineering import compute_cycle_features

        cycles = create_test_cycles(date(2024, 1, 1), [28, 29, 27, 28, 30])

        features = compute_cycle_features(cycles)

        assert "error" not in features
        assert features["n_cycles"] == 5
        assert 27 <= features["mean_length"] <= 29
        assert features["regularity_score"] > 0.5
