"""Backend API schemas."""

from datetime import date
from typing import Optional

from pydantic import BaseModel, Field


class CycleData(BaseModel):
    """Cycle input payload."""

    start_date: date
    end_date: Optional[date] = None
    flow_intensity: Optional[str] = None
    symptoms: list[str] = Field(default_factory=list)


class PredictionResponse(BaseModel):
    """Prediction response payload."""

    predicted_start: Optional[date]
    confidence: float = Field(ge=0.0, le=1.0)
    cycle_length_avg: int

