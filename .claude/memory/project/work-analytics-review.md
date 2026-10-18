---
name: work-analytics-review
description: "Work Analytics" panel (StatsPanel) — where work time, coverage and run ranking (coverage first) come from, and the defects still open
keywords: [StatsPanel, Work Analytics, workTimeMs, duration, totalGrass, coverage, EfficiencyMetrics.fromGrid, compareRuns, getWinnerId, cost, costPerTile, countDamaged]
updated: 2026-10-18
---

### Rule / Fact

How the panel gets its values (fixed 2026-10-18):

- Work time: `useSimulation` owns `workTimeMs`; each tick in `useAppSimulation.runSimulation` adds the real time since the last tick; a new job or `reset` sets it to 0.
- Coverage while a job runs: `tally.mowed / tally.reachableGrass` from the `Episode` (reachable grass only). Map edits (`handleCellClick`) and `reset` use `EfficiencyMetrics.fromGrid`.
- Ranking (user decision 2026-10-18: "coverage first"): `compareRuns` in `src/domain/SimulationHistory.ts` sorts the history list AND picks the winner (`getWinnerId`, needs coverage > 0). Order: highest `coverage`, lowest `cost`, shortest `duration`, newest. Since 2026-10-18 `cost` = benchmark `costPerTile` of the run (the old `penalty` points are gone); records without it load as `cost: null` and rank after scored runs.
- `HistoryRecord.coverage` = this run's `mowedCount / totalGrass` in %, rounded to 0.1 — a run that only finishes a lawn gets a low value. Records saved before this load via `SimulationHistory.fromSaved` with coverage 0, so they rank last.
- Damage card and history damage both use `SimulationGrid.countDamaged()`.

Still open (user did not decide yet):

- Manual stop writes no history record.
- "Battery Usage: Nx" repeats the "Cycles" card. Distance shows "m" but counts cells; speed label uses 0.045 m per cell.
- History duration is wall-clock, so it depends on the speed slider.

### How to apply

Check against the current code before you act; delete lines as they get fixed.

Related: [[algorithm-review-findings]]
