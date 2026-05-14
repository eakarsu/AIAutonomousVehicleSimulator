# Apply Pass 5 — AIAutonomousVehicleSimulator

- **Date:** 2026-05-08
- **Stack:** Node.js + Express + Sequelize/Postgres (`backend/src/`), CRA React (`frontend/`).
- **Audit source:** `_AUDIT/reports/batch_00.md` § 35.
- **Action:** VERIFIED-PRESENT (BE) + IMPLEMENTED-1 (FE wiring).

## Audit-vs-reality

The audit reported "0 AI endpoints" but `routes/aiExtended.js` already
implements compare-scenarios, compliance-check, sensor-fusion-recommendation,
score-scenario, fleet-maintenance-due, plus streaming `/analyze-simulation/stream`.
Pass 2 added scenario-generate and safety-assessment.

## Verified-present

- 7+ AI endpoints in `routes/aiExtended.js`.
- Pass-2 added `/scenario-generate` and `/safety-assessment`.
- `routes/extensions.js` (375 lines) — pass-5 backlog: behavior-model,
  env-randomize, CARLA dispatch, lidar-radar sim, AV-platform export.
- Server entry mounts both `aiExtendedRouter` and `extensions.js` under `/api/ai`.

## Implemented this pass

| # | Item | File | Lines |
|---|------|------|-------|
| 1 | FE page surfacing the pass-5 extension endpoints | `frontend/src/pages/ExtensionsPage.js` (new) | 105 |

App route `/extensions` added (3 lines in `App.js`).

Backend pass-5 backlog (in `routes/extensions.js`):

| BE Endpoint | Backlog tag | Env vars |
|-------------|-------------|----------|
| `POST /api/ai/behavior-model` | TOO-RISKY → text-grounded | `OPENROUTER_API_KEY` |
| `POST /api/ai/env-randomize` | NEEDS-PRODUCT-DECISION (bounded RNG) | — |
| `GET /api/ai/carla/status`, `POST /api/ai/carla/dispatch` | NEEDS-CREDS | `CARLA_API_URL`, `CARLA_API_KEY` |
| `POST /api/ai/lidar-radar/simulate` | TOO-RISKY → in-memory point/return stub | — |
| `GET /api/ai/av-platform/status`, `POST /api/ai/av-platform/export` | NEEDS-CREDS | `AV_PLATFORM`, `AV_PLATFORM_API_KEY` |

## 503-on-no-key

CARLA and AV-platform routes return 503 when env vars missing.
behavior-model returns 503 through `callOpenRouter` when
`OPENROUTER_API_KEY` missing.

## Files written/modified

- `frontend/src/pages/ExtensionsPage.js` (new, 105 lines)
- `frontend/src/App.js` (added 4 lines: import + Route)

## Smoke test

- `node --check backend/src/routes/extensions.js` PASS
- `node --check backend/src/server.js` PASS
- All schema additions are `CREATE TABLE IF NOT EXISTS`.

## Deferred

None — every audit-listed backlog item has a corresponding endpoint.
