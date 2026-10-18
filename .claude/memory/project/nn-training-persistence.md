---
name: nn-training-persistence
description: DECISION 2026-10-18 — NN training progress (champion + full population + GA counters + fitnessConfig) is saved to IndexedDB after every generation and restored on page load; no package; export holds only the best network
keywords: [indexeddb, persistence, page reload, trainingStore, snapshot, population, resume training, clear training, export, import, Float64Array]
updated: 2026-10-18
---

### Rule / Fact

- `src/utils/trainingStore.ts`: IndexedDB `mowerai` → store `training` → key `latest`. No package (user asked for zero or minimal packages). The record holds `Float64Array` weights by structured clone, not JSON (~2.6 MB for 60 × 5 284 weights).
- Saved after every generation in `trainNN` (`useNeuralNetwork.ts`), fire and forget. Restored in a mount effect; the snapshot is ignored when `layers` or weight lengths do not match `NN_LAYERS`, and the population is dropped when its size is not `POPULATION_SIZE`.
- `breedingRef` holds the last population, so a stop/start in the same session also continues the population (before: it reseeded from the champion).
- Import saves the imported net as the champion with `breeding: null` (next run seeds from it). CLEAR TRAINING (Sidebar, with `window.confirm`) deletes the record and gives a fresh untrained net (next run does the warm start again). `fitnessConfig` stays in memory after clear.
- EXPORT writes only `layers, weights, biases, learningRate, epoch, bestFitness` — no population, no Adam state.

### Why

User wanted training to survive a reload and to continue where it stopped. `localStorage` is synchronous and has a 5 MB limit shared with maps and history.

### How to apply

- The save must run before the map refresh in the loop: `bestFitness` and `idealFitness` must come from the same maps ([[nn-progress-bar]]).
- When `NN_LAYERS` or `POPULATION_SIZE` changes, old snapshots are dropped on load, by design.
- New `FitnessConfig` fields get defaults on load (`{ ...DEFAULT_FITNESS_CONFIG, ...saved }`).

Related: [[nn-training-review]], [[simulation-paths-and-nn]]
