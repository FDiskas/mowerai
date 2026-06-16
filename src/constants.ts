export const DEFAULT_MAX_BATTERY = 100;
export const DEFAULT_DRAIN_MOVE = 0.12;
export const DEFAULT_DRAIN_TURN = 0.5;
export const DAMAGE_PER_PASS = 0.15;
export const DAMAGE_PER_TURN = 0.4;

export const CELL_TYPES = {
    GRASS: 'grass',
    OBSTACLE: 'obstacle',
    MOWED: 'mowed',
    DOCK: 'dock'
};

export const ALGORITHMS_LIST = [
    'smart_ai',
    'neural_network',
    'potential_field',
    'boustrophedon',
    'spiral',
    'dfs_coverage',
    'rrt',
    'a_star',
    'energy_conservative_sweep',
];

export const ALGORITHMS_NAMES = {
    smart_ai: 'Greedy (Nearest Grass)',
    neural_network: 'Neural Network (Evolved)',
    potential_field: 'Artificial Potential Fields',
    boustrophedon: 'Boustrophedon (Sweep)',
    spiral: 'Spiral Coverage',
    dfs_coverage: 'Snake Fill (DFS)',
    rrt: 'RRT Exploration',
    a_star: 'A* (Optimal Path)',
    energy_conservative_sweep: 'Energy-Conservative Sweep',
};

