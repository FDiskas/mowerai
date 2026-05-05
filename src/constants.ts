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
    'boustrophedon',
    'potential_field',
    'spiral',
    'rrt',
    'stc',
    'a_star', 
    'dijkstra', 
    'bfs', 
    'greedy_bfs', 
    'jps', 
    'd_star_lite'
];

export const ALGORITHMS_NAMES = { 
    smart_ai: 'Smart AI (Closest)', 
    neural_network: 'Neural Network (Evolved)',
    boustrophedon: 'Boustrophedon (Sweep)',
    potential_field: 'Artificial Potential Fields',
    spiral: 'Spiral Coverage',
    rrt: 'RRT Exploration',
    stc: 'Spanning Tree Coverage',
    a_star: 'A* (Optimal Path)', 
    dijkstra: 'Dijkstra (Uniform)', 
    bfs: 'BFS (Shortest)', 
    greedy_bfs: 'Greedy BFS', 
    jps: 'JPS (Jump Point)', 
    d_star_lite: 'D* Lite (Incremental)'
};

