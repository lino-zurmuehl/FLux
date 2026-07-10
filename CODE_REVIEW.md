# FLux Code Review — Bugs, Security Risks & Improvements

Reviewed: frontend (React/TS PWA), backend (FastAPI), ML pipeline (parsing/prediction plumbing — model training itself excluded per your request), configs, git history.

One piece of good news up front: I verified your git history commit-by-commit — **no real health data was ever committed**. `data/raw`, `data/processed`, `data/models` are properly gitignored, and the only JSON ever tracked is the synthetic `data/test/sample_flo_export.json`. The "Remove sensitive model_params" commit only touched `.gitignore`, so there's nothing to scrub before pushing publicly.

---

## 🔴 High severity

### 1. Data is NOT encrypted at rest — despite the app claiming it is
`frontend/src/utils/encryption.ts` implements solid AES-GCM + PBKDF2 (480k iterations), but **nothing imports it**. Cycles, logs, and settings are stored as plaintext in IndexedDB. Meanwhile:

- Login screen says *"Deine Daten sind verschlüsselt und bleiben lokal"* (`Login.tsx:157`)
- Dashboard says *"…werden verschlüsselt"* (`Dashboard.tsx:51`)
- `CLAUDE.md` claims "All data stored in browser IndexedDB, encrypted with AES-GCM"

Anyone with access to the device (or the browser profile, or a synced browser backup) can open DevTools → IndexedDB and read the entire cycle history, regardless of the PIN. For a period-tracking app this is the single most important gap — this is exactly the data class with real-world legal/abuse risk.

**Fix:** Derive an AES key from the PIN using your existing `deriveKey()` (random per-device salt stored in settings), encrypt cycle/log records before `put`, decrypt after `get`, and hold the key only in memory. Alternatively (weaker but honest): remove the encryption claims from the UI and docs.

### 2. The PIN gate is cosmetic and the hash is trivially brute-forceable
`lib/auth.ts`: PIN is hashed with **one round of SHA-256 and a hard-coded static salt** (`'FLux-PIN-Salt-2024'`). A 4–6 digit PIN has ≤1M candidates — crackable in milliseconds by anyone who reads the `pinHash` from IndexedDB. And since the data itself is plaintext (finding 1), the PIN currently protects nothing: `isAuthenticated` is just a React state flag.

**Fix:** This resolves itself if you implement finding 1 (the PIN becomes the key material; a wrong PIN simply fails to decrypt). If you keep a hash at all, use PBKDF2 with a random salt, and consider auto-locking on tab blur/timeout — right now the app stays unlocked as long as the tab lives.

### 3. Logging any bleeding mid-cycle silently starts a new cycle
`LogEntry.tsx:128-141`:

```ts
const shouldStartNewCycle =
  !latestCycle ||
  (latestCycle.endDate && dateString > latestCycle.startDate);
```

Once the last period has an end date, **any** flow entry on a later date — e.g. ovulation spotting on day 14, which is common — creates a brand-new cycle, shifts `nextPeriodDate`, and corrupts the cycle history that your training runs on. There's also no undo: removing the flow from the log doesn't delete the cycle it created.

**Fix:** Only auto-start a cycle if the date is plausibly a period start (e.g. ≥ ~18–21 days since last start), and/or ask the user ("Neue Periode beginnen?") before creating a cycle from a log entry.

### 4. Re-importing a Flo export duplicates every cycle and log
`Import.tsx` → `importCycles`/`importLogs` use `bulkPut`, but Flo-parsed records carry **no `id`**, so every import appends fresh copies. Import the same file twice and you get 162 cycles instead of 81, duplicate logs per date (which breaks the one-log-per-date assumption behind `getLogByDate`/`addLog`), and inflated `cyclesTrained`. (App-backup restore is fine because exported records include ids.)

**Fix:** Dedupe by `startDate` (cycles) and `date` (logs) before writing — e.g. skip or merge records whose key already exists.

---

## 🟠 Medium severity

### 5. A malformed model_params.json can white-screen the app
`Import.tsx` only validates `prediction` and `trainedAt`. If `stdCycleLength`, `avgCycleLength` or `modelType` are missing/renamed, the Dashboard crashes on `modelParams.stdCycleLength.toFixed(1)` / `modelType.replace(...)` — and since the bad params are already persisted, the crash survives reloads until data is wiped. Validate the full shape (or wrap in a Zod/manual schema check) and reject bad files before saving.

### 6. Frontend and Python Flo importers disagree with each other
Two parsers, three inconsistencies:

- **Symptoms:** `Import.tsx` stores raw Flo subcategories (`"DrawingPain"`, `"TenderBreasts"`) without mapping, so they don't match your `Symptom` union — `SYMPTOM_LABELS[s]` renders `undefined` in LogEntry, and ML symptom counts split into duplicate categories. Python's `flo_parser.py` maps them correctly via `FLO_SYMPTOM_MAP`. Reuse that mapping in the frontend.
- **Sex drive:** frontend matches category `"SexDrive"`, Python matches `"Sex"` — at most one matches the real Flo format; the other silently drops data.
- **Flow/temperature:** Python's `_convert_point_events_to_logs` handles neither `"Period"` nor `"Bbt"` events, so flow intensity and BBT are dropped when training directly from a Flo export (the frontend importer handles both). Also `FLO_DISTURBER_MAP` only covers Stress/Alcohol, but your types include illness/travel/poor_sleep.

### 7. Fertile-window / ovulation math is inconsistent (health-relevant)
Three different definitions coexist:

- ML (`feature_engineering.predict_fertile_window`): ovulation = next period − 14; window = ovulation−5 … ovulation. Cycle-length aware. ✔️
- `db.ts updatePredictionForNewCycle`: hardcodes window to **days 10–16** regardless of cycle length. For a 35-day cycle the ML says ~days 16–21 — the frontend overwrites it with 10–16 the moment a period is logged.
- `PredictionCard` displays "Eisprung" as the **midpoint** of the window, but in the ML's definition ovulation is the window's **end** — so the displayed ovulation date is ~2–3 days early.

Pick one definition (the ML one is the sensible anchor: `ovulation = start + expectedCycleLength − 14`) and use it everywhere. Given people may use this for family planning, also consider a small disclaimer that predictions are estimates and not suitable as contraception.

### 8. Period start throws away the trained prediction
`updatePredictionForNewCycle` recomputes `nextPeriodDate` from `Math.round(avgCycleLength)` but leaves `prediction.expectedCycleLength` (possibly a Prophet output) untouched — so the card's "X-Tage-Zyklus" and the actual predicted date can disagree, and the Prophet-predicted length is discarded on every logged period. Use `prediction.expectedCycleLength` for the date shift, or update both consistently.

### 9. The backend is dead code that contradicts your privacy story
`backend/` is all TODO stubs (routes store nothing, prediction service is unused by the app), yet it ships CORS config (`localhost:3000`, but Vite dev runs on 5173), pulls in FastAPI/uvicorn/cryptography as **required** dependencies, and its docstrings promise server-side encrypted storage. Settings.tsx meanwhile promises "Es wird nichts an einen Server gesendet." Recommendation: delete `backend/` (and the FastAPI deps in `pyproject.toml`) until you actually need a server — less code, smaller attack surface, honest architecture. Keep `tests/ml`.

---

## 🟡 Low severity / polish

- **`getCurrentCycleDay` modulo fallback** (`db.ts:297`): when the prediction is stale, wrapping the cycle day with `%` shows "day 3" for what is actually day 31+ — consider showing overdue state instead of silently wrapping (the card's overdue logic never triggers via this path).
- **Cycle `length` never maintained by the app**: Flo-imported cycles keep their imported `length` even after you correct start dates (`QuickLog` corrections), and ML prefers stored `length` over recomputing from dates — a corrected date won't fix the training data. Consider recomputing `length` from dates at export time, or having ML always derive from consecutive start dates.
- **Outlier filters disagree**: ML accepts 21–45 days, backend stub 21–35. Cosmetic today (backend is dead), but pick one constant.
- **`cyclesTrained` counts all cycles**, not the valid/filtered ones — the "Erfasste Zyklen" stat overstates what the model actually used.
- **Temperature input isn't validated on save** (`LogEntry.tsx`): min/max are UI hints only; a typo like 3.65 or 365 goes straight into training data. Clamp/validate 35–42 °C before saving.
- **GitHub Pages + BrowserRouter**: deep links (e.g. `/FLux/settings`) 404 on first load before the service worker takes over. Add the `404.html` redirect trick or switch to `HashRouter`.
- **`index.html`**: `lang="en"` on a German app; `theme_color` differs between index.html (`#ec4899`) and the PWA manifest (`#881337`).
- **Settings "Auf GitHub ansehen"** links to a placeholder `https://github.com`.
- **`alert()`/`confirm()`-style UX** in QuickLog/Settings — inline messages would be nicer and are already your pattern in Import.tsx.
- **Tracked junk files**: `.DS_Store` and `data/.DS_Store` are committed (`git rm --cached`), plus stale `vite.config.js`/`.d.ts`/`.tsbuildinfo` artifacts alongside `vite.config.ts`.
- **Docs drift**: CLAUDE.md/AGENTS.md describe a password-based encryption flow, a History page, `predictor.ts`/`floParser.ts` files, and `python -m ml.train` (actual CLI is `python -m ml train`) — none of which match the code. Worth refreshing since coding agents read these files.
- **Thin test coverage where the bugs actually live**: no tests for `db.ts` cycle/prediction logic, the Import parsers, or QuickLog's cycle state machine — exactly the areas findings 3, 4, 6 and 8 came from. The Vitest setup exists (`npm test`) but there are no frontend tests at all.

---

## Suggested order of attack

1. Encrypt IndexedDB with a PIN-derived key (fixes findings 1+2 together) — or soften the UI claims immediately.
2. Fix the mid-cycle-bleeding → new-cycle logic (3) and import dedupe (4) — these silently corrupt the data you'll train on, so they're worth fixing **before** your next training run.
3. Unify Flo parsing (6) and fertile-window math (7).
4. Validate model imports (5), align `updatePredictionForNewCycle` (8).
5. Delete the backend (9), then sweep the polish list.
