# FLux app audit

Reviewed 10 November 2026. Scope: navigation, daily period tracking, calendar corrections, encrypted persistence, and browser/Python model data exchange. This was a code and workflow audit, not a penetration test or prediction-accuracy study.

## Addressed

- **Navigation priority:** removed the raised central “Eintrag” button. Home now places period start/end before the cycle ring, with symptoms and notes as a secondary action. A first period can be recorded without importing data.
- **Corrections:** home and history link to the calendar at the relevant period. Tap an existing period and drag to move it; select start/end to adjust a boundary. Tap or drag across unmarked days to add a missed period. Date fields provide a keyboard alternative and allow corrections across months. Changes require saving; overlapping periods and future/invalid dates are rejected.
- **Forgotten ends:** an open period defaults to five inclusive calendar days. It closes after day five, on unlock, return to the app, or the next foreground check (once a minute). Reopening much later records the original fifth day, not the reopening date. Existing explicit ends are preserved. Existing imported durations are respected when supplied. Automatic ends are labelled and editable.
- **Model integrity:** automatic duration assumptions are excluded from bleeding-duration averages in both browser and Python training. The flag survives app import/export. Historical insertions invalidate cached intervals; prediction dates stay anchored to the latest recorded start. Corrections update the associated prediction-accuracy record. Existing diary observations remain on their recorded dates.
- **Neutral cycle display:** “Rund um den Eisprung” and the estimated date range appear throughout the six-day window. There is no countdown to a specific ovulation day or wording directed at becoming pregnant. Calendar and cycle-ring terminology use the same neutral phrase. The ring's fallback window now matches the model's six-day range.
- **Encrypted saves:** writes are serialized to prevent an older encryption operation from overwriting a newer snapshot. A failed save does not block later saves. Full deletion locks the store and waits for queued writes before clearing it, preventing those writes from restoring deleted data.

## Remaining findings

| Priority | Finding | Evidence and impact | Follow-up |
| --- | --- | --- | --- |
| P1 | Short PINs provide limited protection against a copied database | `frontend/src/pages/Login.tsx`, `handleSetup`, accepts four characters. The salt and authenticated encrypted blob in `frontend/src/lib/secureStore.ts` let an attacker test guesses offline. PBKDF2 slows guesses but cannot add secret entropy. | Offer and encourage a strong passphrase; preserve compatibility with existing PINs. |
| P1 | Concurrent tabs can overwrite each other's changes | `frontend/src/lib/secureStore.ts` keeps a separate decrypted dataset and write queue in each tab and writes the whole blob. The queue added here orders writes within one tab; it does not coordinate multiple tabs. | Add cross-tab revision/conflict checks or restrict editing to one unlocked tab. |
| P2 | No automatic session lock | `frontend/src/contexts/AuthContext.tsx` unlocks until explicit logout/reload. There is no inactivity/background timeout to drop the in-memory key. | Add a configurable inactivity lock and resume authentication. |
| P2 | Imported dates are not fully validated before storage | `frontend/src/pages/Import.tsx`, `parseDate`, extracts date-shaped text without checking actual calendar validity, chronology, or overlaps. Calendar edits now validate these conditions, but existing import paths still accept malformed history. | Validate and preview imported records before committing them, with row-level errors. |

When automatic training is disabled or there are too few valid intervals, edits re-anchor the existing prediction; its trained cycle-length estimate is retained. This follows the existing manual-training setting and is not a new model fit.

## Verification

- Production TypeScript/Vite/PWA build passed.
- 30 frontend tests passed, covering dates, actions, prediction windows, training, and encrypted write ordering/deletion.
- 12 Python tests passed, including automatic-end flag parsing and exclusion from duration averages.
- Mobile browser preview checked at 390 px. Verified that home correction opens the correct calendar month, dragging a period shifts both dates, and saving displays the updated period with a success message.
- Screenshots and preview use synthetic data. No personal health data was imported for this audit.
