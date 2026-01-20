"""Tests for the API endpoints."""

import pytest
from httpx import AsyncClient, ASGITransport

from backend.main import app


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_health_check(client):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


@pytest.mark.asyncio
async def test_get_cycles_empty(client):
    response = await client.get("/api/v1/cycles")
    assert response.status_code == 200
    assert response.json() == {"cycles": []}


@pytest.mark.asyncio
async def test_predict_no_data(client):
    response = await client.get("/api/v1/predict")
    assert response.status_code == 200
    data = response.json()
    assert data["predicted_start"] is None
    assert data["confidence"] == 0.0
