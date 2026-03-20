"""Schemas shared across FLux ML pipeline modules."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any


def _parse_date(value: Any) -> date | None:
    """Parse an incoming value into a date."""
    if value is None:
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, (int, float)):
        ts = float(value)
        if ts > 1e12:
            ts = ts / 1000.0
        return datetime.fromtimestamp(ts).date()

    text = str(value).strip()
    if not text:
        return None

    # Fast path for ISO-like values.
    if "T" in text or " " in text:
        try:
            return datetime.fromisoformat(text.replace("Z", "+00:00")).date()
        except ValueError:
            pass

    date_text = text[:10]
    formats = ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%Y/%m/%d", "%d-%m-%Y", "%d.%m.%Y")
    for fmt in formats:
        try:
            return datetime.strptime(date_text, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"Invalid date value: {value!r}")


def _parse_datetime(value: Any) -> datetime | None:
    """Parse an incoming value into a datetime."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime.combine(value, datetime.min.time())
    if isinstance(value, (int, float)):
        ts = float(value)
        if ts > 1e12:
            ts = ts / 1000.0
        return datetime.fromtimestamp(ts)

    text = str(value).strip()
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError(f"Invalid datetime value: {value!r}") from exc


@dataclass
class Cycle:
    """A menstrual cycle entry."""

    start_date: date
    id: int | None = None
    end_date: date | None = None
    length: int | None = None
    period_length: int | None = None

    def __post_init__(self) -> None:
        parsed_start = _parse_date(self.start_date)
        if parsed_start is None:
            raise ValueError("Cycle.start_date is required")
        self.start_date = parsed_start
        self.id = int(self.id) if self.id is not None else None
        self.end_date = _parse_date(self.end_date)
        self.length = int(self.length) if self.length is not None else None
        self.period_length = int(self.period_length) if self.period_length is not None else None

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "start_date": self.start_date.isoformat(),
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "length": self.length,
            "period_length": self.period_length,
        }


@dataclass
class DailyLog:
    """A daily symptom / mood / flow tracking entry."""

    date: date
    id: int | None = None
    flow: str | None = None
    symptoms: list[str] = field(default_factory=list)
    mood: str | None = None
    fluid: str | None = None
    sex_drive: str | None = None
    disturbers: list[str] = field(default_factory=list)
    temperature: float | None = None
    notes: str | None = None
    is_period: bool | None = None

    def __post_init__(self) -> None:
        parsed_date = _parse_date(self.date)
        if parsed_date is None:
            raise ValueError("DailyLog.date is required")
        self.date = parsed_date
        self.id = int(self.id) if self.id is not None else None
        self.symptoms = list(self.symptoms or [])
        self.disturbers = list(self.disturbers or [])
        self.temperature = float(self.temperature) if self.temperature is not None else None
        self.is_period = bool(self.is_period) if self.is_period is not None else None

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "date": self.date.isoformat(),
            "flow": self.flow,
            "symptoms": self.symptoms,
            "mood": self.mood,
            "fluid": self.fluid,
            "sex_drive": self.sex_drive,
            "disturbers": self.disturbers,
            "temperature": self.temperature,
            "notes": self.notes,
            "is_period": self.is_period,
        }


@dataclass
class Prediction:
    """Model prediction result."""

    next_period_date: date
    confidence: float
    expected_cycle_length: int
    fertile_window_start: date | None = None
    fertile_window_end: date | None = None
    period_length: int | None = None

    def __post_init__(self) -> None:
        parsed_next = _parse_date(self.next_period_date)
        if parsed_next is None:
            raise ValueError("Prediction.next_period_date is required")
        self.next_period_date = parsed_next
        self.fertile_window_start = _parse_date(self.fertile_window_start)
        self.fertile_window_end = _parse_date(self.fertile_window_end)
        self.expected_cycle_length = int(self.expected_cycle_length)
        self.confidence = float(self.confidence)
        self.period_length = int(self.period_length) if self.period_length is not None else None

    def to_dict(self) -> dict[str, Any]:
        return {
            "next_period_date": self.next_period_date.isoformat(),
            "confidence": self.confidence,
            "expected_cycle_length": self.expected_cycle_length,
            "fertile_window_start": (
                self.fertile_window_start.isoformat() if self.fertile_window_start else None
            ),
            "fertile_window_end": (
                self.fertile_window_end.isoformat() if self.fertile_window_end else None
            ),
            "period_length": self.period_length,
        }


@dataclass
class ModelParams:
    """Serialized training output consumed by the frontend app."""

    trained_at: datetime
    cycles_trained: int
    model_type: str
    prediction: Prediction
    avg_cycle_length: float
    std_cycle_length: float
    avg_period_length: float | None = None
    recent_cycle_lengths: list[int] = field(default_factory=list)
    trend: float | None = None
    seasonality: dict[str, Any] | None = None

    def __post_init__(self) -> None:
        parsed_trained = _parse_datetime(self.trained_at)
        if parsed_trained is None:
            raise ValueError("ModelParams.trained_at is required")
        self.trained_at = parsed_trained
        if isinstance(self.prediction, dict):
            self.prediction = Prediction(**self.prediction)
        self.cycles_trained = int(self.cycles_trained)
        self.avg_cycle_length = float(self.avg_cycle_length)
        self.std_cycle_length = float(self.std_cycle_length)
        self.avg_period_length = (
            float(self.avg_period_length) if self.avg_period_length is not None else None
        )
        self.recent_cycle_lengths = [int(v) for v in self.recent_cycle_lengths]
        self.trend = float(self.trend) if self.trend is not None else None

    def to_dict(self) -> dict[str, Any]:
        return {
            "trained_at": self.trained_at.isoformat(),
            "cycles_trained": self.cycles_trained,
            "model_type": self.model_type,
            "prediction": self.prediction.to_dict(),
            "avg_cycle_length": self.avg_cycle_length,
            "std_cycle_length": self.std_cycle_length,
            "avg_period_length": self.avg_period_length,
            "recent_cycle_lengths": self.recent_cycle_lengths,
            "trend": self.trend,
            "seasonality": self.seasonality,
        }


@dataclass
class AppExport:
    """Browser export payload used for retraining."""

    exported_at: datetime
    cycles: list[Cycle] = field(default_factory=list)
    logs: list[DailyLog] = field(default_factory=list)

    def __post_init__(self) -> None:
        parsed_exported = _parse_datetime(self.exported_at)
        if parsed_exported is None:
            raise ValueError("AppExport.exported_at is required")
        self.exported_at = parsed_exported

        normalized_cycles: list[Cycle] = []
        for cycle in self.cycles:
            if isinstance(cycle, Cycle):
                normalized_cycles.append(cycle)
            else:
                normalized_cycles.append(Cycle(**cycle))
        self.cycles = normalized_cycles

        normalized_logs: list[DailyLog] = []
        for log in self.logs:
            if isinstance(log, DailyLog):
                normalized_logs.append(log)
            else:
                normalized_logs.append(DailyLog(**log))
        self.logs = normalized_logs
