"""Auto-assumed period ends round-trip without training duration averages."""

import json
from datetime import date

from ml.models.cycle_predictor import CyclePredictor
from ml.models.schemas import Cycle
from ml.preprocessing.feature_engineering import compute_cycle_features
from ml.preprocessing.flo_parser import FloParser, parse_app_export


def test_cycle_auto_ended_serializes_and_app_export_accepts_both_spellings(tmp_path):
    cycle = Cycle(start_date=date(2025, 1, 1), period_length=5, auto_ended=True)
    assert cycle.to_dict()["auto_ended"] is True

    for field in ("autoEnded", "auto_ended"):
        path = tmp_path / f"{field}.json"
        path.write_text(json.dumps({
            "exportedAt": "2025-02-01T10:00:00Z",
            "cycles": [{"startDate": "2025-01-01", "periodLength": 5, field: True}],
            "logs": [],
        }))
        imported = parse_app_export(path)
        assert imported.cycles[0].auto_ended is True


def test_flo_cycle_parser_preserves_auto_ended_flag():
    parser = FloParser.__new__(FloParser)
    parser.raw_data = {"cycles": [
        {"startDate": "2025-01-01", "periodLength": 5, "autoEnded": True},
        {"start_date": "2025-02-01", "period_length": 4, "auto_ended": True},
    ]}

    cycles = parser._parse_cycles()
    assert [cycle.auto_ended for cycle in cycles] == [True, True]


def test_assumed_period_lengths_are_excluded_but_cycle_start_intervals_remain():
    cycles = [
        Cycle(start_date=date(2025, 1, 1), length=28, period_length=5, auto_ended=True),
        Cycle(start_date=date(2025, 1, 29), length=30, period_length=4),
        Cycle(start_date=date(2025, 2, 28), length=29, period_length=6, auto_ended=True),
        Cycle(start_date=date(2025, 3, 29), period_length=3),
    ]

    features = compute_cycle_features(cycles)
    assert features["avg_period_length"] == 3.5

    predictor = CyclePredictor(model_type="weighted_average")
    predictor.fit(cycles)
    params = predictor.export_params()
    assert params.avg_period_length == 3.5
    assert params.prediction is not None
    assert params.prediction.period_length == 4
    assert predictor._valid_lengths == [28, 30, 29]
