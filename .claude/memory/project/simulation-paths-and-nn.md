---
name: simulation-paths-and-nn
description: The places that step the mower (live sim, NN preview, training fitness, imitation) — preview/fitness/imitation share advanceMower; the battery/dock-return logic is still copied in fitness; 47-input model contract
keywords: [preview, LIVE ON, mowTile, MowingStep, SimulationService, fitness, runFitnessEpisode, evaluateFitness, advanceMower, episode, training worker, imitation worker, neural network, 47 inputs, prepareNNInputs, damage, genetic algorithm]
updated: 2026-10-18
---

### Rule / Fact

Three code paths move the mower and apply mowing rules:

1. **Live simulation** — `src/hooks/useAppSimulation.ts` → `SimulationService.calculateStep` (`src/services/SimulationService.ts`) → `mowTile` (`src/domain/MowingStep.ts`). State is immutable domain classes in `src/domain/`.
2. **NN preview** — `src/hooks/useNeuralNetwork.ts`. Runs only while training. Each run drives the champion it starts with; it restarts when the lawn is done (`getNeuralNetworkMove` returns `null`), the battery is empty or the mower spins. Stopping training switches the preview off (`setShowVisualTraining(false)`), so the main grid shows again.
3. **NN training** — `runFitnessEpisode` / `evaluateFitness` (`src/utils/fitness.ts`) inside `src/training.worker.ts`, one worker per `navigator.hardwareConcurrency`.
4. **Warm start** — `collectDemonstrations` (`src/utils/imitation.ts`) inside `src/imitation.worker.ts`.

Paths 2–4 step with `advanceMower` (`src/utils/episode.ts`), which cuts the tile being left with `mowTile`, like the live sim. The live sim's low-battery return, charging to 80 % and final return to the dock (`getNextStep` in `useAppSimulation.ts`) are **copied** into `runFitnessEpisode`, not shared.

The network (`src/NeuralNetwork.ts`, evolved by a genetic algorithm in `useNeuralNetwork.ts`) takes **47** inputs from `prepareNNInputs` (`src/algorithms/neuralNetwork.ts`). Loaded or saved models must have `layers[0] === 47`, or `useNeuralNetwork.ts` rejects them.

### Why

Until 2026-10-18 training had its own cut rule (cut on enter) and never drove home, so it rewarded a different world than the one the user sees. The battery/dock logic can still drift apart.

### How to apply

- When you change the return-to-dock or charging rules in `useAppSimulation.ts`, update `runFitnessEpisode` too.
- When you change the number of NN inputs, update `NN_LAYERS` in `useNeuralNetwork.ts`. Old exported models will stop loading.
- Fitness weights live in `DEFAULT_FITNESS_CONFIG` (`src/types.ts`); `Sidebar.tsx` can override them at runtime. `turnPenalty / mowedRevisitPenalty` is also the path turn cost of every algorithm, so all three paths must set `State.turnCost` ([[turn-cost-from-training-weights]]).
- The network shape is `NN_LAYERS` in `useNeuralNetwork.ts`; the `47` checks use `NN_INPUTS`.
- Training data crosses the worker boundary by `postMessage`, so pass plain objects (layers + weights), not class instances.

Related: [[add-mowing-algorithm]]
