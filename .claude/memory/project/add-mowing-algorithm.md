---
name: add-mowing-algorithm
description: Every place to change when you add, rename or remove a mowing algorithm — move function, barrel, ALGORITHM_MOVES in algorithmPolicies.ts, constants, legacy ids, tests; it then joins the benchmark automatically
keywords: [algorithm, add algorithm, ALGORITHMS_LIST, ALGORITHMS_NAMES, ALGORITHM_MOVES, algorithmPolicy, ALGORITHM_IDS, legacy id, runCoverage, testSupport, benchmark]
updated: 2026-10-18
---

### Rule / Fact

An algorithm is a move function `(state: State, grid: Grid, prevDir: Direction, CELL_TYPES, ...) => Point | null`. `grid` is the mower's **known** map (unseen tiles look like grass). To add one, change all of these:

1. `src/algorithms/<name>.ts` — the move function. Keep per-run memory in optional fields of `State` (`src/types.ts`), for example `cellData`, `spiralCenter`, `goal`. Each job gets a fresh `State` from `Episode`, so nothing has to be reset by hand.
2. `src/algorithms/index.ts` — re-export it from the barrel.
3. `src/simulation/algorithmPolicies.ts` — add it to `ALGORITHM_MOVES`. `ALGORITHM_IDS` comes from this map, so the benchmark, training validation and "Proof Benchmark" include it at once.
4. `src/constants.ts` — add the id to `ALGORITHMS_LIST` and a label to `ALGORITHMS_NAMES`.
5. `src/algorithms/<name>.test.ts` — use `buildLawn` and `runCoverage` from `src/algorithms/testSupport.ts`.

### Why

The registration is spread over several files and nothing type-checks that `ALGORITHMS_LIST` and `ALGORITHM_MOVES` agree. An unknown id silently runs Smart AI.

### How to apply

- Removed ids can still come from `localStorage` history; `LEGACY_SWEEP_IDS` in `algorithmPolicies.ts` maps them to Boustrophedon.
- A `null` move makes `algorithmPolicy` fall back to Smart AI; low battery and the trip home are the `Episode`'s job ([[simulation-paths-and-nn]]).
- If the algorithm caches anything derived from the map, rebuild it when `state.mapVersion` changes (see `cellIdGridVersion`).
- Lane sweepers reuse `nextLaneSweepStep` (`src/algorithms/laneSweep.ts`). Pass `turnCostOf(state)` to every path search; use `committedGoal` for heading-dependent targets ([[turn-cost-from-training-weights]]).

Related: [[simulation-paths-and-nn]]
