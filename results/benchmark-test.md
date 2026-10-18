# Benchmark: test set, 60 lawns (seeds 2000000–2000059)

Score weights: {"step":1,"turn":2,"overlap":1,"chargeTrip":25,"missedTile":20,"notDocked":100}. Lower cost per tile is better.
Network: generation 10, validation cost 2.188.
Run time: 1 s.

| Model | Mean cost / tile | Completed runs |
| --- | ---: | ---: |
| neural_network | 1.835 | 60/60 |
| dfs_coverage | 1.901 | 60/60 |
| smart_ai | 1.901 | 60/60 |
| energy_conservative_sweep | 1.903 | 60/60 |
| a_star | 1.939 | 60/60 |
| boustrophedon | 1.988 | 60/60 |
| cellular_decomposition | 1.992 | 60/60 |
| potential_field | 1.996 | 60/60 |
| rrt | 2.110 | 60/60 |
| spiral | 2.498 | 60/60 |

## Head to head

- **neural_network** vs best other model per map: 22 wins, 3 ties, 35 losses of 60 maps
  - mean difference 0.051 cost/tile (95 % CI 0.014 … 0.088), sign test p = 0.111
  - best other model per map: smart_ai 13, boustrophedon 12, dfs_coverage 11, cellular_decomposition 4, energy_conservative_sweep 6, potential_field 5, a_star 5, rrt 2, spiral 2
- **smart_ai** vs best other model per map: 3 wins, 4 ties, 53 losses of 60 maps
  - mean difference 0.141 cost/tile (95 % CI 0.098 … 0.184), sign test p = 8.14e-13
  - best other model per map: cellular_decomposition 4, boustrophedon 10, neural_network 23, potential_field 6, a_star 4, dfs_coverage 6, rrt 3, energy_conservative_sweep 4
- **potential_field** vs best other model per map: 3 wins, 3 ties, 54 losses of 60 maps
  - mean difference 0.235 cost/tile (95 % CI 0.188 … 0.283), sign test p = 4.29e-13
  - best other model per map: smart_ai 8, boustrophedon 10, neural_network 22, cellular_decomposition 3, rrt 3, a_star 3, dfs_coverage 7, energy_conservative_sweep 4
- **boustrophedon** vs best other model per map: 9 wins, 2 ties, 49 losses of 60 maps
  - mean difference 0.223 cost/tile (95 % CI 0.156 … 0.289), sign test p = 8.96e-8
  - best other model per map: smart_ai 8, neural_network 24, cellular_decomposition 3, potential_field 5, a_star 4, dfs_coverage 6, energy_conservative_sweep 7, rrt 2, spiral 1
- **spiral** vs best other model per map: 0 wins, 1 ties, 59 losses of 60 maps
  - mean difference 0.741 cost/tile (95 % CI 0.596 … 0.886), sign test p = 3.47e-18
  - best other model per map: smart_ai 7, boustrophedon 10, neural_network 22, cellular_decomposition 3, potential_field 4, a_star 3, dfs_coverage 5, rrt 2, energy_conservative_sweep 4
- **dfs_coverage** vs best other model per map: 3 wins, 4 ties, 53 losses of 60 maps
  - mean difference 0.137 cost/tile (95 % CI 0.092 … 0.181), sign test p = 8.14e-13
  - best other model per map: smart_ai 8, boustrophedon 10, neural_network 23, cellular_decomposition 3, potential_field 4, a_star 3, energy_conservative_sweep 7, rrt 2
- **rrt** vs best other model per map: 1 wins, 4 ties, 55 losses of 60 maps
  - mean difference 0.353 cost/tile (95 % CI 0.264 … 0.441), sign test p = 1.58e-15
  - best other model per map: smart_ai 7, boustrophedon 10, neural_network 22, cellular_decomposition 3, potential_field 4, a_star 5, dfs_coverage 5, energy_conservative_sweep 4
- **a_star** vs best other model per map: 3 wins, 5 ties, 52 losses of 60 maps
  - mean difference 0.181 cost/tile (95 % CI 0.119 … 0.243), sign test p = 1.54e-12
  - best other model per map: smart_ai 8, boustrophedon 10, neural_network 24, cellular_decomposition 3, potential_field 4, dfs_coverage 5, rrt 2, energy_conservative_sweep 4
- **energy_conservative_sweep** vs best other model per map: 4 wins, 4 ties, 52 losses of 60 maps
  - mean difference 0.145 cost/tile (95 % CI 0.101 … 0.189), sign test p = 1.10e-11
  - best other model per map: smart_ai 8, boustrophedon 12, neural_network 22, cellular_decomposition 3, potential_field 4, a_star 3, dfs_coverage 6, rrt 2
- **cellular_decomposition** vs best other model per map: 2 wins, 4 ties, 54 losses of 60 maps
  - mean difference 0.234 cost/tile (95 % CI 0.176 … 0.292), sign test p = 4.43e-14
  - best other model per map: smart_ai 7, boustrophedon 10, neural_network 24, potential_field 4, a_star 3, dfs_coverage 6, rrt 2, energy_conservative_sweep 4
