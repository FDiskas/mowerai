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
    'smart_ai', 'neural_network', 'cellular_boustrophedon', 'slam_boustrophedon', 'zigzag', 'u_shape', 'a_star', 
    'dijkstra', 'bfs', 'greedy_bfs', 'jps', 'd_star_lite', 'custom_mower'
];

export const ALGORITHMS_NAMES = { 
    smart_ai: 'Smart AI', 
    neural_network: 'Neural Network',
    cellular_boustrophedon: 'Cellular Boustrophedon',
    slam_boustrophedon: 'SLAM Boustrophedon', 
    zigzag: 'Zigzag (V)', 
    u_shape: 'U-Shape (H)', 
    a_star: 'A* (A-Star)', 
    dijkstra: 'Dijkstra', 
    bfs: 'BFS', 
    greedy_bfs: 'Greedy BFS', 
    jps: 'JPS (Jump Point)', 
    d_star_lite: 'D* Lite', 
    custom_mower: 'Custom (Best)' 
};
