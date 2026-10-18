---
name: algorithm-review-findings
description: Outcome of the 2026-10-18 review and fixes of the mowing algorithms — getClosestGrass own-tile bug, lane sweep helper, ring spiral, benchmark method and numbers, open follow-ups
keywords: [a_star, aStarSearch, rrt, getClosestGrass, spiral, laneSweep, nextLaneSweepStep, orientation, benchmark, fallback, review, spiralStep]
updated: 2026-10-18
---

### Rule / Fact

- The mower cuts a tile when it **leaves** it (`SimulationService.calculateStep` → `mowTile`), so the tile under the mower is still `GRASS`. Any "nearest grass" helper must skip the own tile. Before the fix, `getClosestGrass` returned the own tile, so `a_star` (999 of 999 moves) and `rrt` silently fell back to Smart AI. Fixed: `getClosestGrass` skips `pos`; `aStarSearch` returns `null` at once when start == target.
- `dfs_coverage`, `energy_conservative_sweep` and `cellular_decomposition` share `nextLaneSweepStep` (`src/algorithms/laneSweep.ts`): keep the lane, shift one tile, turn back along the mowed lane. Without it they spiralled inwards and ignored the orientation setting. Without an orientation, lanes follow the current heading.
- `spiral` now mows square rings (Chebyshev distance) around the start, cheapest tile first inside a ring (distance plus turns), only reachable tiles, with a committed goal. A strict ring order failed from a corner dock (long crossings between the ends of each clipped L-shaped ring).
- `smart_ai` was left as is on purpose: it is the fallback for every algorithm.
- Benchmark sum over 16 obstacle maps (old → new steps): spiral 21720 → 20954 (turns 7782 → 4898), dfs 19199 → 19131, energy 21492 → 20716, cellular 22843 → 22957, a_star 20564 → 16200 but turns 4212 → 8016.

### Why

Saves a new investigation of why these algorithms looked alike, and records the trade-offs that were accepted.

### How to apply

- To compare algorithm changes, drive the move functions on `buildLawn` maps (corner and middle dock, both orientations) and sum steps and turns for old vs new code. One map is not enough: single-map results moved by ±10 % as noise.
- Done since: unused `State` fields (`spiralStep`, `zigzagIdx`, `uShapeIdx`, `slamDir`, `stcPath`) removed; diagonal rays in `prepareNNInputs` cast once; turn cost now configurable (see [[turn-cost-from-training-weights]]).
- Open follow-ups: `potential_field` has no attractive term; `genericPathSearch` uses string keys in a `Map`.
- Fixed 2026-10-18 (user approved): "Test All" stale closures. `stopSimulation` now starts the next model through `runSimulationRef` (latest `runSimulation`), and `prepareSimulationState` is declared before it. Before the fix, `neural_network` in Test All silently ran Smart AI; after it, NN results differ from Smart AI (checked in the browser). `simState` now starts from the initial `env`, because `App.tsx` loads the saved lawn on the first render and no longer calls `prepareSimulationState` on mount.
- The NN input `distToTarget` changed meaning with the `getClosestGrass` fix (it was almost always 0). Older trained models saw the old value.

Related: [[add-mowing-algorithm]], [[simulation-paths-and-nn]], [[turn-cost-from-training-weights]]
