---
name: nn-training-review
description: 2026-10-18 NN training review and steps 1+2 (fixes + Snake Fill warm start) — what changed, measured before/after, why choice penalties only count on decision steps, and the open step 3 (the hand-written wrapper still decides most moves)
keywords: [genetic algorithm, neuroevolution, fitness, runFitnessEpisode, getNeuralNetworkMove, wrapper, softmax, champion, crownChampion, generateTrainingMaps, rooms, completionBonus, imitation, warm start, behaviour cloning, Snake Fill, evolution strategies, benchmark, decision steps]
updated: 2026-10-18
---

### Rule / Fact

Done (user chose steps 1+2 on 2026-10-18):

- Fitness follows live rules: cut on leave, low-battery trip home and charge to 80 %, return to the dock at the end (`completionBonus` now reachable), only reachable grass counts.
- **Choice terms (visit limit, overlap penalty, compounding wear, discovery, straight line, orientation) only count on decision steps = fresh grass next to the mower.** Counting them on trips home and A* transits made the wear term (`× (1 + wear·200)`) reach −1…−5 million and ranked random nets above Snake Fill.
- Champion is re-scored when maps change (`crownChampion`, `src/utils/evolution.ts`). "maze" (70 % obstacles) replaced by connected rooms (`src/utils/trainingMaps.ts`).
- `NeuralNetwork`: Adam state created on first `train`; `copy()` 190 µs → 3 µs; `train()` 77 → 53 µs.
- Warm start: first training run of an untrained net clones `dfs_coverage` (3 map sets, both orientations, 8 epochs, ~13.8k samples, ~4 s in a worker), reaches ~100 % match. Seeded populations now use small mutations (0.15 / 0.1).

Measured (bench script kept outside repo; 8 fixed runs 25x20, drain 0.12/0.5): Snake Fill, random nets, warm start and GA results all within ~2 % (≈4 690 steps, 100 % coverage). Random nets differ from the wrapper's final move only via the wrapper: wrapper overrides the net's top choice in 46–76 % of decisions; on an open lawn, Snake Fill and random nets produce the **identical** path and score.

### Why

The network barely controls the mower, so better training cannot show in results. That is step 3.

### How to apply

- Step 3 (waiting for user): shrink the +1.0 grass / +0.8 alignment bonuses in `getNeuralNetworkMove` (or let the net choose among valid moves), then consider evolution strategies instead of the GA. Re-run the same bench before/after.
- The fitness weights (`DEFAULT_FITNESS_CONFIG`) were not changed; keep the decision-step rule if you add trips or new forced movement.

Related: [[simulation-paths-and-nn]], [[turn-cost-from-training-weights]], [[algorithm-review-findings]]
