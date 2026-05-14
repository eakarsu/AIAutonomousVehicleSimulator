# Audit Apply Note — AIAutonomousVehicleSimulator

Source: `_AUDIT/reports/batch_00.md` § 35.

## Audit findings vs. reality
The audit reported "0 AI endpoints" but the codebase already implements `compare-scenarios`, `compliance-check`, `sensor-fusion-recommendation`, `score-scenario`, `fleet-maintenance-due`, and a streaming `/analyze-simulation/stream` in `routes/aiExtended.js`.

Truly missing items: scenario generation, behavior modeling, safety assessment, environment randomization. Two of these are clearly mechanical (scenario generation, safety assessment).

## Implemented in this pass (MECHANICAL)

| # | Item | File | Endpoint |
|---|------|------|----------|
| 1 | AI scenario generation (procedural edge cases) | `backend/src/routes/aiExtended.js` | `POST /api/ai/scenario-generate` |
| 2 | AI safety assessment (ASIL / SOTIF) | `backend/src/routes/aiExtended.js` | `POST /api/ai/safety-assessment` |

Both use existing `callOpenRouter` and `persistAIResult` helpers; validation via `express-validator` matches in-file conventions. `node --check` passes.

## Backlog (not implemented)

| Item | Tag | Why deferred |
|------|-----|---------------|
| AI vehicle behavior modeling | TOO-RISKY | Needs trained model on real driving data |
| Environment randomization | NEEDS-PRODUCT-DECISION | Coupling to physics engine |
| CARLA / Apollo / Baidu integration | NEEDS-CREDS | External SDK; possibly heavy installs |
| Lidar/radar simulation | TOO-RISKY | Substantial new module |
| AV platform integrations (Waymo, Cruise, Tesla) | NEEDS-CREDS | Vendor partnerships |

## Apply pass 3 (frontend)

- **Action:** LEFT-AS-IS — FE already wired.
- `frontend/src/services/api.js` exposes wrappers for every AI endpoint in `aiExtended.js`: `scenarioGenerate`, `safetyAssessment`, `complianceCheck`, `sensorFusionRecommendation`, `scoreScenario`, `fleetMaintenanceDue`, `analyzeSimulationStreamUrl`.
- Dedicated pages already present: `AIScenarioSafetyPage.js`, `AIStreamAnalysisPage.js`, `CompliancePathwayPage.js`, `SafetyMetricsPage.js`, `ScenarioComparisonPage.js`.
- No frontend changes applied this pass.
