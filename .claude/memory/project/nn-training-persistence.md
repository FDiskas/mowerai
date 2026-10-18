---
name: nn-training-persistence
description: DECISION 2026-10-18 — browser NN training state (evolution-strategy params + Adam moments + best validated network) is saved to IndexedDB every validation and restored on load; else the shipped public/models/policy.json loads; export = best network as a model file
keywords: [indexeddb, persistence, page reload, trainingStore, snapshot, resume training, clear training, export, import, Float32Array, policy.json]
updated: 2026-10-19
---

### Rule / Fact

- `src/utils/trainingStore.ts`: IndexedDB `mowerai` → store `training` → key `latest`. No package. The snapshot holds `Float32Array`s by structured clone: ES `params`, `m`, `v`, `generation`, and the best network (`bestParams`, `bestGeneration`, `bestValidationCost`).
- `useNeuralNetwork` saves after every validation (every 10 generations), fire and forget. On load: IndexedDB snapshot if its shape fits `NETWORK_LAYERS`; otherwise the shipped `/models/policy.json` (only parsed when the response is JSON — Vite answers a missing file with `index.html`); otherwise an untrained network (seed 1).
- The best network (lowest mean validation cost) is the one the app drives with; the ES state can be worse.
- Browser training stops by itself after `STOP_AFTER_GENERATIONS_WITHOUT_IMPROVEMENT` (50) generations with no better validated network, counted from the start of the current run (a restored ES generation does not count). The sidebar shows the counter.
- Import replaces the model and starts a fresh ES state from it. CLEAR TRAINING deletes the record and gives an untrained network.
- Snapshots of the old GA format (`championWeights`) are ignored by `fromSnapshot`.

### Why

The user wanted training to survive a reload and continue where it stopped (2026-10-18, kept for the ES rewrite).

### How to apply

- A change of `NETWORK_LAYERS` drops old snapshots on load, by design.

Related: [[simulation-paths-and-nn]], [[real-nn-vs-algorithms-plan]]
