# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FLux is a **privacy-focused, local-first Flo app replacement** with ML-based cycle predictions. It uses a hybrid architecture:

- **Browser app** for daily logging and displaying predictions
- **Python ML pipeline** (runs on your Mac) for training sophisticated prediction models

### How the App Works

1. **Initial Setup**:
   - Import historical data from Flo app export
   - Run Python training script on Mac to build initial model
   - Import model parameters into browser app

2. **Daily Use** (browser app):
   - View next predicted period date on dashboard
   - Log period start/end when they occur
   - Log daily symptoms, mood, flow, temperature

3. **Monthly Retraining** (after each period ends):
   - Export data from browser app
   - Run Python retraining script on Mac
   - Import updated model parameters into browser app
   - Predictions improve with each cycle

### Why This Architecture?

| Component | Why |
|-----------|-----|
| Browser app | Convenient daily use, works offline, no server costs |
| Python ML | Real machine learning (Prophet, XGBoost), uses all features, better accuracy |
| Local only | Maximum privacy - data never leaves your devices |

### Core User Flows

- **Dashboard**: Shows next predicted period date, current cycle day, confidence score
- **Log Period**: Input actual period start/end dates
- **Log Symptoms**: Daily logging of symptoms, mood, flow, temperature
- **Import/Export**: Flo data import, data export for training, model import
- **Settings**: Delete data, manage password

## Privacy & Security

- All data stored in browser IndexedDB, encrypted with AES-GCM
- Encryption key derived from user password using PBKDF2 (100k+ iterations)
- Password never stored - only the derived key in memory during session
- Training data exported as JSON (stays on your Mac)
- Full data deletion clears IndexedDB completely

## Commands

```bash
# === Frontend (browser app) ===
cd frontend
npm install
npm run dev          # Development server
npm run build        # Production build
npm test

# === ML Pipeline (Python on Mac) ===
cd ml
pip install -e ".[dev]"

# Initial training with Flo export
python -m ml.train --input flo_export.json --output model_params.json

# Monthly retraining with exported app data
python -m ml.train --input exported_data.json --output model_params.json

# Run tests
pytest
```

## Architecture

```
FLux/
├── frontend/                 # React + TypeScript PWA (daily use)
│   ├── public/
│   │   ├── manifest.json    # PWA manifest
│   │   └── sw.js            # Service worker for offline
│   └── src/
│       ├── components/      # UI components
│       │   ├── CycleCalendar.tsx
│       │   ├── PredictionCard.tsx
│       │   ├── LogEntryForm.tsx
│       │   └── FileUpload.tsx
│       ├── pages/
│       │   ├── Dashboard.tsx     # Main view with prediction
│       │   ├── LogEntry.tsx      # Daily logging interface
│       │   ├── History.tsx       # Past cycles and logs
│       │   ├── Import.tsx        # Flo import + model import
│       │   └── Settings.tsx      # Export, delete, password
│       ├── lib/
│       │   ├── db.ts             # IndexedDB wrapper (Dexie.js)
│       │   ├── encryption.ts     # Web Crypto API encryption
│       │   ├── predictor.ts      # Loads model params, makes predictions
│       │   └── floParser.ts      # Flo export JSON parser
│       ├── hooks/
│       ├── types/
│       └── App.tsx
│
├── ml/                       # Python ML pipeline (runs on Mac)
│   ├── preprocessing/
│   │   ├── flo_parser.py    # Parse Flo app exports
│   │   └── feature_engineering.py
│   ├── models/
│   │   └── cycle_predictor.py    # Prophet/XGBoost model
│   ├── training/
│   │   └── train.py         # Training script
│   └── __main__.py          # CLI entry point
│
├── data/                     # Local data (gitignored)
│   ├── exports/             # Exported data from browser
│   └── models/              # Trained model parameters
│
└── tests/
```

## Data Exchange Format

### Export from Browser (for training)
```json
{
  "exportedAt": "2024-01-15T10:00:00Z",
  "cycles": [
    { "startDate": "2024-01-01", "endDate": "2024-01-05", "length": 29 }
  ],
  "logs": [
    {
      "date": "2024-01-01",
      "flow": "heavy",
      "symptoms": ["cramps", "headache"],
      "mood": "irritable",
      "temperature": 36.4,
      "notes": "..."
    }
  ]
}
```

### Model Parameters (import to browser)
```json
{
  "trainedAt": "2024-01-15T10:30:00Z",
  "cyclesTrained": 12,
  "prediction": {
    "nextPeriodDate": "2024-02-01",
    "confidence": 0.85,
    "expectedLength": 29,
    "fertileWindowStart": "2024-01-15",
    "fertileWindowEnd": "2024-01-20"
  },
  "model": {
    "type": "prophet",
    "avgCycleLength": 29.2,
    "stdDev": 1.8,
    "trend": -0.1,
    "seasonality": { ... }
  }
}
```

## ML Pipeline Details

### Features Used for Prediction

| Feature | Source | Impact |
|---------|--------|--------|
| Cycle length history | Period dates | Primary predictor |
| Cycle length trend | Computed | Detects lengthening/shortening |
| Symptom patterns | Daily logs | Pre-period symptom onset |
| Temperature shift | Daily logs | Ovulation detection |
| Flow patterns | Daily logs | Cycle phase indicators |

### Model Options

**Prophet** (recommended): Facebook's time series model, handles irregularity well
**XGBoost**: Gradient boosting, good with many features
**Weighted Average**: Simple fallback, uses recent cycle lengths

### Training Script

```bash
# Initial training from Flo export
python -m ml.train \
  --input ~/Downloads/flo_export.json \
  --output model_params.json \
  --model prophet

# Monthly retraining
python -m ml.train \
  --input exported_data.json \
  --output model_params.json \
  --model prophet
```

## Browser App Components

### Data Layer (`src/lib/`)

**db.ts**: IndexedDB via Dexie.js
- `cycles`: Period start/end dates
- `logs`: Daily symptom/mood/flow entries
- `settings`: App settings
- `model`: Current model parameters

**encryption.ts**: Web Crypto API (AES-GCM + PBKDF2)

**predictor.ts**: Loads model params from IndexedDB, calculates days until prediction, provides confidence score. Does NOT do ML - just uses pre-computed model output.

**floParser.ts**: Parses Flo JSON export for initial data seeding.

### Pages

- **Dashboard**: Countdown to next period, current cycle day, confidence meter, mini calendar
- **LogEntry**: Forms for period start/end, symptoms, mood, flow, temperature
- **History**: Calendar view, past cycles list, log search
- **Import**: Flo import (initial), model params import (monthly), data export
- **Settings**: Password change, full data export, delete all data

## Data Flow

### Initial Setup
```
Flo Export (JSON)
      │
      ▼
┌─────────────────┐     ┌─────────────────┐
│  Python ML      │────▶│  model_params   │
│  (on Mac)       │     │  .json          │
└─────────────────┘     └────────┬────────┘
                                 │
      ┌──────────────────────────┘
      ▼
┌─────────────────┐
│  Browser App    │  ← Also imports Flo data for history
│  (IndexedDB)    │
└─────────────────┘
```

### Monthly Retraining
```
┌─────────────────┐
│  Browser App    │
│  "Export Data"  │
└────────┬────────┘
         │
         ▼
   exported_data.json
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  Python ML      │────▶│  model_params   │
│  (on Mac)       │     │  .json          │
└─────────────────┘     └────────┬────────┘
                                 │
         ┌───────────────────────┘
         ▼
┌─────────────────┐
│  Browser App    │
│  "Import Model" │
└─────────────────┘
```

## Tracking Variables

Logged daily in browser, used for ML training:

- **Period dates**: Start and end date (required)
- **Flow intensity**: Spotting, light, medium, heavy
- **Symptoms**: Cramps, headache, bloating, breast tenderness, fatigue, acne, backache
- **Mood**: Happy, calm, anxious, irritable, sad, energetic
- **Temperature**: Basal body temperature (optional, improves accuracy)
- **Notes**: Free-form text

## Tech Stack

### Frontend
- React 18 + TypeScript
- Vite
- Dexie.js (IndexedDB)
- Web Crypto API
- date-fns
- Tailwind CSS
- PWA (service worker)

### ML Pipeline
- Python 3.10+
- Prophet (time series)
- pandas, numpy
- scikit-learn (optional: XGBoost)
- pytest

## Deployment

Browser app is static files - host anywhere free:
```bash
cd frontend && npm run build
# Deploy dist/ to GitHub Pages, Netlify, Vercel, etc.
```

ML pipeline stays on your Mac - no deployment needed.
