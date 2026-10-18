# project

- [tooling-and-commands](tooling-and-commands.md) — npm, Node 22, dev on port 3000, Vitest, ESLint (no Biome); README errors; no AI SDK. tags: npm, vite, eslint, tests
- [add-mowing-algorithm](add-mowing-algorithm.md) — checklist to add/remove an algorithm: move fn, barrel, ALGORITHM_MOVES, constants; joins the benchmark automatically. tags: algorithm, constants, policies
- [simulation-paths-and-nn](simulation-paths-and-nn.md) — one Episode engine for live sim, preview, training, benchmark; unknown map + sensor; end rules; 482-input network and model-file contract. tags: episode, known map, fog, nn, worker
- [algorithm-review-findings](algorithm-review-findings.md) — own-tile bug in getClosestGrass (fixed), shared lane sweep, ring spiral, benchmark method/numbers, open follow-ups, Test All stale-closure bug (fixed). tags: a_star, rrt, spiral, laneSweep, benchmark
- [turn-cost-from-training-weights](turn-cost-from-training-weights.md) — turn cost fixed at 2 = SCORE_WEIGHTS.turn/step for all algorithms; committedGoal stops oscillation. tags: turnCost, score, goal
- [work-analytics-review](work-analytics-review.md) — Work Analytics panel: work time, coverage, run ranking coverage-first then cost/tile; open: manual stop not logged. tags: StatsPanel, duration, coverage, cost
- [nn-training-persistence](nn-training-persistence.md) — DECISION: ES state + best validated net in IndexedDB, restored on load; else shipped policy.json; export = model file. tags: indexeddb, persistence, resume, export
- [real-nn-vs-algorithms-plan](real-nn-vs-algorithms-plan.md) — DECISION + STATUS: prove a real NN beats algorithms; fixed score, unknown map, held-out lawns; distance inputs + imitation-then-ES allowed; rollout teacher 2.02, shipped net 2.188 val; test: best mean (1.835) but per-lawn 22W/35L, not proven. tags: proof, benchmark, imitation, rollout teacher
