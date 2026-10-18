---
name: add-mowing-algorithm
description: Every place to change when you add, rename or remove a mowing algorithm — constants, barrel export, dispatch map in useAppSimulation, legacy id fallback, coverage test
keywords: [algorithm, add algorithm, ALGORITHMS_LIST, ALGORITHMS_NAMES, dispatch, fns map, useAppSimulation, legacy id, runCoverage, testSupport]
updated: 2026-10-18
---

### Rule / Fact

An algorithm is a move function `(state: State, grid: Grid, prevDir: Direction, CELL_TYPES, ...) => Point | null` that returns the next tile for one step. To add one, change all of these:

1. `src/algorithms/<name>.ts` — the move function. Keep per-run memory in optional fields of `State` (`src/types.ts`), for example `cellData`, `spiralCenter`, `goal`.
2. `src/algorithms/index.ts` — re-export it from the barrel.
3. `src/constants.ts` — add the id to `ALGORITHMS_LIST` and a label to `ALGORITHMS_NAMES`.
4. `src/hooks/useAppSimulation.ts` — add the id to the `fns` map in `getNextStep`.
5. If you add a new per-run `State` field, add it to `freshRunState()` in `useAppSimulation.ts` (used by `runSimulation` and `prepareSimulationState`).
6. `src/algorithms/<name>.test.ts` — use `buildLawn` and `runCoverage` from `src/algorithms/testSupport.ts`.

### Why

The registration is spread over four files and nothing type-checks that they agree. A missing `fns` entry does not fail: `getNextStep` silently falls back to `getSmartAIMove`.

### How to apply

- Removed or renamed ids can still come from old records in `localStorage` (`mowerai_history`). `getNextStep` maps old ids (`stc`, `zigzag`, `u_shape`, `slam_boustrophedon`, `cellular_boustrophedon`) to Boustrophedon. Add a removed id to that list.
- If a move function returns `null` while grass remains, the hook falls back to Smart AI; when no grass remains, it paths back to the dock.
- Below 20 % battery, the hook overrides every algorithm and returns to the dock.
- Lane-based sweepers should reuse `nextLaneSweepStep` from `src/algorithms/laneSweep.ts`, so they follow the orientation setting.
- Pass `turnCostOf(state)` to every path search, and use `committedGoal` for heading-dependent target choice ([[turn-cost-from-training-weights]]).
- Per-run fields are cleared by `freshRunState()` in `useAppSimulation.ts`; add new per-run `State` fields there.

Related: [[simulation-paths-and-nn]]
