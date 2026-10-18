---
name: turn-cost-from-training-weights
description: Turn cost of every algorithm is fixed at 2 steps = SCORE_WEIGHTS.turn / step (the proof score), set by the Episode config; committedGoal prevents oscillation. Was turnPenalty / mowedRevisitPenalty until 2026-10-18
keywords: [turnCost, turnCostOf, DEFAULT_TURN_COST, SCORE_WEIGHTS, minTurnsTo, committedGoal, State.goal, target choice, oscillation, EpisodeConfig]
updated: 2026-10-18
---

### Rule / Fact

- `DEFAULT_TURN_COST` (`src/algorithms/turnCost.ts`) = `SCORE_WEIGHTS.turn / SCORE_WEIGHTS.step` = **2**, the same price the benchmark score puts on a turn. `EpisodeConfig.turnCost` sets `State.turnCost` from it. The old editable fitness weights (`FitnessConfig`, `turnCostInSteps`) were removed with the GA on 2026-10-18.
- Algorithms read it with `turnCostOf(state)`. Energy Sweep uses 5x, Cell Decomposition 2x (local) / 3x (transit) — the user chose to keep these ratios earlier.
- The cost also applies to target choice (`getClosestGrass` with heading, spiral ring choice) via `minTurnsTo`. Re-choosing every step made the mower oscillate, so `committedGoal` keeps `State.goal` until it is cut (`a_star`, `rrt`, `spiral`).

### Why

The algorithms plan with the same turn price the proof score charges, so they are not handicapped in the comparison.

### How to apply

- New algorithms: pass `turnCostOf(state)` to every path search; never hard-code a turn penalty.
- Heading-dependent target choice must go through `committedGoal`.
- Do not change `SCORE_WEIGHTS` to make the network look better ([[real-nn-vs-algorithms-plan]]).

Related: [[algorithm-review-findings]], [[simulation-paths-and-nn]], [[add-mowing-algorithm]]
