"""API routes for period tracking."""

from fastapi import APIRouter, UploadFile, File, Depends
from typing import Optional

from backend.models.schemas import CycleData, PredictionResponse
from backend.services.encryption import EncryptionService
from backend.services.prediction import PredictionService

router = APIRouter()


@router.post("/import/flo")
async def import_flo_data(file: UploadFile = File(...)):
    """Import data from Flo app export."""
    # TODO: Implement Flo data parsing
    return {"message": "Import endpoint - to be implemented"}


@router.post("/cycles")
async def add_cycle(cycle: CycleData):
    """Add a new cycle entry."""
    # TODO: Encrypt and store cycle data
    return {"message": "Cycle added"}


@router.get("/cycles")
async def get_cycles():
    """Get all cycles for current user."""
    # TODO: Decrypt and return cycle data
    return {"cycles": []}


@router.get("/predict", response_model=PredictionResponse)
async def predict_next_period():
    """Predict next period based on historical data."""
    # TODO: Run prediction model
    return PredictionResponse(
        predicted_start=None,
        confidence=0.0,
        cycle_length_avg=0,
    )
