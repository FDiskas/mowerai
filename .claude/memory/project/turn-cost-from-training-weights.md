---
name: turn-cost-from-training-weights
description: Decision (2026-10-18) — every algorithm's turn cost comes from the training weights (turnPenalty / mowedRevisitPenalty), set on State.turnCost in the live sim, NN preview and fitness; goal commitment prevents oscillation
keywords: [turnCost, turnCostInSteps, turnCostOf, DEFAULT_TURN_COST, turnPenalty, mowedRevisitPenalty, minTurnsTo, committedGoal, State.goal, fitnessConfig, target choice, oscillation]
updated: 2026-10-18
---

### Rule / Fact

- The user decided: one turn cost for all algorithms, taken from the training "Turn" weight. Path cost in steps = `turnPenalty / mowedRevisitPenalty` (`turnCostInSteps` in `src/algorithms/turnCost.ts`). Defaults 100 / 50 = **2** steps; the old fixed value was 5.
- Negative `turnPenalty` → 0; `mowedRevisitPenalty` ≤ 0 → default. The Sidebar shows the result under the "Turn" field.
- Algorithms read it with `turnCostOf(state)` (`State.turnCost`, optional, default 2). Energy Sweep uses 5x, Cell Decomposition 2x (local) / 3x (transit) — the user chose to keep these ratios.
- Set in three places: `useAppSimulation` (at run start, from `config.turnCost` that `App.tsx` builds from `fitnessConfig`), `useNeuralNetwork` preview state and `startEpisode` (`src/utils/episode.ts`, used by fitness and warm start).
- The cost also applies to target choice (`getClosestGrass` with heading, spiral ring choice) via `minTurnsTo`. Because that choice depends on the heading, re-choosing every step made the mower oscillate between two tiles. `committedGoal` keeps `State.goal` until it is cut; `a_star`, `rrt`, `spiral` use it.

### Why

The user wanted turn behaviour to be configurable in one place and consistent with how the NN is trained.

### How to apply

- New algorithms: pass `turnCostOf(state)` to every path search; never hard-code a turn penalty.
- Any heading-dependent target choice must go through `committedGoal`, or it can oscillate.
- With Turn = 250 (cost 5), `smart_ai`, `potential_field` and `boustrophedon` reproduce the old results exactly.

Related: [[algorithm-review-findings]], [[simulation-paths-and-nn]], [[add-mowing-algorithm]]
