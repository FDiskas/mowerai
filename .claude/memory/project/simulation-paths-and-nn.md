---
name: simulation-paths-and-nn
description: One shared Episode engine (src/simulation/episode.ts) steps every model — live sim, NN preview, training, benchmark; unknown map with sensor; rules for charge/home/stall; network inputs/outputs and model-file contract
keywords: [Episode, episode engine, runEpisode, MovePolicy, known map, sensor, sensorRange, fog, unknown map, mapVersion, charge trip, stall, step limit, useAppSimulation, networkPolicy, observe, NETWORK_LAYERS, model file, policy.json, worker]
updated: 2026-10-18
---

### Rule / Fact

- Since 2026-10-18 (branch `real-network`) every path that moves the mower uses `Episode` in `src/simulation/episode.ts`: the live sim (`useAppSimulation` calls `episode.step` once per tick and copies its state into the domain classes), the NN live preview (`useNeuralNetwork`), training and the benchmark (`src/simulation/tasks.ts` in workers). The old copies (`utils/episode.ts`, `utils/fitness.ts`, the hook's own dock logic and watchdog) are gone.
- Unknown map: `Episode.lawn` is the real lawn; `Episode.known` (`src/simulation/knownMap.ts`) is what the mower has seen. `state.grid === known.grid`; unseen tiles look like GRASS there, so planners go and look. A square sensor (`sensorRange`, default 2) reveals tiles; a found obstacle bumps `state.mapVersion` (cellular decomposition rebuilds on it).
- Engine rules, the same for every model: cut the tile being left; battery < 20 % → planned route home, charge to 80 %, count a charge trip; known map has no reachable grass (own tile excluded) or the policy returns null → route home → `completed`. Ends early on `stranded`, `stalled` (no cut for `stallStepsPerTile` × area mowing steps), `step-limit`, `no-way-home`. A policy move that is not a neighbour or hits an obstacle throws.
- Algorithms are policies via `algorithmPolicy(id)` (`src/simulation/algorithmPolicies.ts`), with the Smart AI fallback the app always had.
- Network policy (`src/simulation/networkPolicy.ts`): inputs turned to the heading (forward = up): 9×9 window × 4 channels (blocked, unseen, grass, mowed), 7×7 coarse blocks of 5×5 × 3 shares (grass, unseen, blocked), battery, dock offset, and per move the distance-to-grass nearness 1/(1+d) and gradient sign (user allowed 2026-10-18) → 482 inputs; `NETWORK_LAYERS = [482, 32, 32, 4]`, tanh; outputs ahead/right/back/left; argmax over legal moves only, no other override.
- Model files: `{ format: 'mowerai-policy', layers, params, generation, validationCost }` (`modelFile.ts`); `parseModelFile` rejects other shapes. The app loads `public/models/policy.json` when IndexedDB has no progress.

### Why

The user wanted one fair rule set for the proof that a network beats the algorithms ([[real-nn-vs-algorithms-plan]]); copies of the dock logic had drifted before.

### How to apply

- Change mowing, battery or end rules only in `Episode`; all paths follow.
- Changing the inputs changes `NETWORK_LAYERS`: saved IndexedDB progress and model files stop loading, by design.
- Workers get plain data (`NetworkData` with `Float32Array`), never class instances.

Related: [[add-mowing-algorithm]], [[real-nn-vs-algorithms-plan]], [[turn-cost-from-training-weights]]
