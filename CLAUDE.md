# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FLux is a privacy-focused period tracking application with ML-based cycle predictions. It imports data from Flo app exports and provides predictions for the next period using time series analysis.

**Privacy principles:**
- All cycle data is encrypted at rest using user-derived keys (PBKDF2 + AES-GCM)
- Server never sees plaintext health data
- Client-side encryption available in browser
- Users can export and delete their data at any time

## Commands

```bash
# Install dependencies
pip install -e ".[dev]"

# Run backend server
uvicorn backend.main:app --reload

# Run tests
pytest

# Run single test file
pytest tests/ml/test_predictor.py

# Run with coverage
pytest --cov=backend --cov=ml

# Lint and format
ruff check .
ruff format .

# Type check
mypy backend ml

# Frontend (from frontend/ directory)
npm install
npm run dev
npm run build
npm test
```

## Architecture

```
FLux/
├── backend/           # FastAPI REST API
│   ├── api/          # Route definitions
│   ├── models/       # Pydantic schemas
│   └── services/     # Encryption, prediction services
├── ml/               # Machine learning module
│   ├── preprocessing/ # Flo data parser, feature engineering
│   ├── models/       # CyclePredictor time series model
│   └── training/     # Training scripts
├── frontend/         # React + TypeScript web app
│   └── src/
│       ├── components/
│       ├── pages/
│       └── utils/    # Client-side encryption
├── data/             # Local data storage (gitignored)
│   ├── raw/          # Flo exports
│   └── processed/    # Processed cycle data
└── tests/
```

## Key Components

**Backend API** (`backend/main.py`): FastAPI app with endpoints for cycle CRUD, Flo import, and predictions. CORS configured for localhost:3000.

**Encryption** (`backend/services/encryption.py`): PBKDF2 key derivation (480k iterations) + Fernet symmetric encryption. Keys derived from user password, never stored.

**Cycle Predictor** (`ml/models/cycle_predictor.py`): Weighted moving average model for cycle length prediction. Filters physiologically implausible values (outside 21-45 days). Confidence score based on cycle regularity.

**Flo Parser** (`ml/preprocessing/flo_parser.py`): Parses Flo app JSON exports. Structure needs adaptation based on actual export format - current implementation is a template.

## Data Flow

1. User uploads Flo export → `POST /api/v1/import/flo`
2. `FloParser` extracts cycle dates → stored encrypted
3. `CyclePredictor.predict()` computes weighted average of past cycles
4. Prediction returned with confidence score
