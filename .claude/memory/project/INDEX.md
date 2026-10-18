# project

- [tooling-and-commands](tooling-and-commands.md) — npm, Node 22, dev on port 3000, Vitest, ESLint (no Biome); README errors; no AI SDK. tags: npm, vite, eslint, tests
- [add-mowing-algorithm](add-mowing-algorithm.md) — checklist of the 4+ files to change when adding/removing an algorithm; legacy id fallback. tags: algorithm, constants, dispatch
- [simulation-paths-and-nn](simulation-paths-and-nn.md) — live sim vs NN preview (restarts when done, off on stop) vs fitness vs warm start; shared advanceMower (cut on leave); dock-return logic copied in fitness; 47-input contract. tags: mowTile, fitness, worker, nn
- [algorithm-review-findings](algorithm-review-findings.md) — own-tile bug in getClosestGrass (fixed), shared lane sweep, ring spiral, benchmark method/numbers, open follow-ups, Test All stale-closure bug (fixed). tags: a_star, rrt, spiral, laneSweep, benchmark
- [turn-cost-from-training-weights](turn-cost-from-training-weights.md) — DECISION: all algorithms' turn cost = turnPenalty / mowedRevisitPenalty (default 2), set in 3 places; committedGoal stops oscillation. tags: turnCost, training, goal
- [work-analytics-review](work-analytics-review.md) — Work Analytics panel: work time, coverage from grid, run ranking coverage-first (compareRuns, HistoryRecord.coverage); open: manual stop not logged. tags: StatsPanel, duration, coverage, penalty
- [nn-training-review](nn-training-review.md) — NN training steps 1+2 done 2026-10-18: live-rule fitness, decision-step penalties, champion re-score, Snake Fill warm start; wrapper still decides most moves → step 3 open. tags: genetic algorithm, fitness, imitation, neuroevolution
- [nn-progress-bar](nn-progress-bar.md) — DECISION: NN bar = bestFitness / idealFitness (perfect run, min turns 2×(lanes−1)) instead of /400000; measured 48–61 % on training maps. tags: progress bar, idealFitness, Sidebar
- [nn-training-persistence](nn-training-persistence.md) — DECISION: training progress (champion + population) in IndexedDB after each generation, restored on load; CLEAR TRAINING; export = best net only. tags: indexeddb, persistence, resume, export
