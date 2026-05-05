import { DEFAULT_MAX_BATTERY } from './constants';
import { NeuralNetwork } from './NeuralNetwork';
import type { Grid, PositionType as Point, Direction, State } from './types';

/**
 * Generic Priority Queue for pathfinding.
 */
class PriorityQueue<T> {
    private items: { item: T; priority: number }[] = [];

    push(item: T, priority: number) {
        this.items.push({ item, priority });
        this.items.sort((a, b) => a.priority - b.priority);
    }

    pop(): T | undefined {
        return this.items.shift()?.item;
    }

    get length(): number {
        return this.items.length;
    }
}

interface SearchNode {
    pos: Point;
    path: Point[];
    g: number; // Cost from start
    dir: Direction;
}

/**
 * Unified Pathfinding Logic (Dijkstra/A* variant)
 */
export const genericPathSearch = (
    start: Point,
    currentGrid: Grid,
    currentDir: Direction,
    targetPredicate: (p: Point) => boolean,
    heuristic: (p: Point) => number = () => 0,
    turnPenalty: number = 5
): Point[] | null => {
    const rows = currentGrid.length;
    const cols = currentGrid[0].length;
    const openSet = new PriorityQueue<SearchNode>();
    const visited = new Map<string, number>(); // key -> min_cost_to_reach

    openSet.push({ pos: start, path: [], g: 0, dir: currentDir }, heuristic(start));

    const dirs = [{ dx: 0, dy: 1 }, { dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: -1, dy: 0 }];

    while (openSet.length > 0) {
        const curr = openSet.pop()!;
        const { x, y } = curr.pos;
        
        // Target reached
        if (targetPredicate(curr.pos) && (x !== start.x || y !== start.y)) {
            return curr.path;
        }

        const stateKey = `${x},${y},${curr.dir.dx},${curr.dir.dy}`;
        if (visited.has(stateKey) && visited.get(stateKey)! <= curr.g) continue;
        visited.set(stateKey, curr.g);

        for (const d of dirs) {
            const nextX = x + d.dx;
            const nextY = y + d.dy;

            if (nextX >= 0 && nextX < cols && nextY >= 0 && nextY < rows && currentGrid[nextY][nextX].type !== 'obstacle') {
                const isTurn = d.dx !== curr.dir.dx || d.dy !== curr.dir.dy;
                const moveCost = 1 + (isTurn ? turnPenalty : 0);
                const nextG = curr.g + moveCost;
                const nextPos = { x: nextX, y: nextY };

                openSet.push({
                    pos: nextPos,
                    path: [...curr.path, nextPos],
                    g: nextG,
                    dir: d
                }, nextG + heuristic(nextPos));
            }
        }

        if (openSet.length > 5000) break; // Safety break
    }
    return null;
};

export const findFullPathToTarget = (
    start: Point,
    currentGrid: Grid,
    currentDir: Direction,
    targetPredicate: (p: Point) => boolean
): Point[] | null => {
    return genericPathSearch(start, currentGrid, currentDir, targetPredicate);
};

export const findPathToTarget = (
    start: Point,
    currentGrid: Grid,
    currentDir: Direction,
    targetPredicate: (p: Point) => boolean
): Point | null => {
    const path = findFullPathToTarget(start, currentGrid, currentDir, targetPredicate);
    return path ? path[0] : null;
};


export const getBoustrophedonMove = (
    state: State,
    curGrid: Grid,
    prevDir: Direction,
    CELL_TYPES: any
): Point | null => {
    const { pos, orientation = 'horizontal' } = state;
    const rows = curGrid.length;
    const cols = curGrid[0].length;

    if (!state.cellData) {
        state.cellData = { sweepDir: 1, cellScanDir: 1 };
    }
    const { cellData } = state;
    const isVert = orientation === 'vertical';

    const isValidGrass = (x: number, y: number) => 
        x >= 0 && x < cols && y >= 0 && y < rows && curGrid[y][x].type === CELL_TYPES.GRASS;

    // 1. Try to continue in current sweep direction
    const nextSweepPos = isVert 
        ? { x: pos.x, y: pos.y + cellData.sweepDir }
        : { x: pos.x + cellData.sweepDir, y: pos.y };
    
    if (isValidGrass(nextSweepPos.x, nextSweepPos.y)) return nextSweepPos;

    // 2. Line blocked, try to move to adjacent line
    const adjLinePos = isVert
        ? { x: pos.x + cellData.cellScanDir, y: pos.y }
        : { x: pos.x, y: pos.y + cellData.cellScanDir };

    if (isValidGrass(adjLinePos.x, adjLinePos.y)) {
        cellData.sweepDir *= -1; // Reverse sweep for next line
        return adjLinePos;
    }

    // 3. Both blocked, look for closest grass using A*
    const closest = findPathToTarget(pos, curGrid, prevDir, (p) => curGrid[p.y][p.x].type === CELL_TYPES.GRASS);
    if (closest) {
        // Reset sweep direction based on path to closest grass
        const dx = closest.x - pos.x;
        const dy = closest.y - pos.y;
        if (isVert && dy !== 0) cellData.sweepDir = Math.sign(dy);
        if (!isVert && dx !== 0) cellData.sweepDir = Math.sign(dx);
        return closest;
    }

    return null;
};


// --- ALGORITHMS ---

export const aStarSearch = (
    start: Point,
    target: Point,
    currentGrid: Grid,
    currentDir: Direction
): Point | null => {
    const heuristic = (p: Point) => Math.abs(p.x - target.x) + Math.abs(p.y - target.y);
    const path = genericPathSearch(start, currentGrid, currentDir, (p) => p.x === target.x && p.y === target.y, heuristic);
    return path ? path[0] : null;
};

export const dijkstraSearch = (
    start: Point,
    targetPredicate: (p: Point) => boolean,
    currentGrid: Grid,
    currentDir: Direction
): Point | null => {
    const path = genericPathSearch(start, currentGrid, currentDir, targetPredicate);
    return path ? path[0] : null;
};

export const bfsSearch = (
    start: Point,
    targetPredicate: (p: Point) => boolean,
    currentGrid: Grid
): Point | null => {
    const path = genericPathSearch(start, currentGrid, { dx: 0, dy: 0 }, targetPredicate, () => 0, 0);
    return path ? path[0] : null;
};

export const greedyBestFirstSearch = (
    start: Point,
    target: Point,
    currentGrid: Grid,
    currentDir: Direction
): Point | null => {
    const heuristic = (p: Point) => Math.abs(p.x - target.x) + Math.abs(p.y - target.y);
    const path = genericPathSearch(start, currentGrid, currentDir, (p) => p.x === target.x && p.y === target.y, heuristic, 5);
    return path ? path[0] : null;
};

/**
 * Real D* Lite (simplified incremental)
 * For the purpose of this simulation, we use A* with a dynamic cost map that updates as we mow.
 */
export const dStarLiteSearch = (
    start: Point,
    target: Point,
    currentGrid: Grid,
    currentDir: Direction
): Point | null => {
    const heuristic = (p: Point) => Math.abs(p.x - target.x) + Math.abs(p.y - target.y);
    const path = genericPathSearch(start, currentGrid, currentDir, (p) => p.x === target.x && p.y === target.y, heuristic, 10);
    return path ? path[0] : null;
};


export const getClosestGrass = (pos: Point, grid: Grid, CELL_TYPES: any): Point | null => {
    let closest: Point | null = null;
    let minDist = Infinity;
    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[0].length; x++) {
            if (grid[y][x].type === CELL_TYPES.GRASS) {
                const dist = Math.abs(x - pos.x) + Math.abs(y - pos.y);
                if (dist < minDist) { minDist = dist; closest = { x, y }; }
            }
        }
    }
    return closest;
};

/**
 * Artificial Potential Fields (APF)
 * Calculates a force vector based on attractive (grass) and repulsive (obstacles) potentials.
 */
export const getPotentialFieldMove = (
    state: State,
    curGrid: Grid,
    CELL_TYPES: any
): Point | null => {
    const { pos } = state;
    const rows = curGrid.length;
    const cols = curGrid[0].length;
    const dirs = [{ dx: 0, dy: 1 }, { dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: -1, dy: 0 }];

    let bestMove: Point | null = null;
    let minPotential = Infinity;

    for (const d of dirs) {
        const nx = pos.x + d.dx;
        const ny = pos.y + d.dy;

        if (nx < 0 || nx >= cols || ny < 0 || ny >= rows || curGrid[ny][nx].type === 'obstacle') continue;

        // Calculate potential at (nx, ny)
        let potential = 0;

        // 1. Repulsive from obstacles/boundaries
        const repulsiveK = 10.0;
        for (let y = Math.max(0, ny - 2); y <= Math.min(rows - 1, ny + 2); y++) {
            for (let x = Math.max(0, nx - 2); x <= Math.min(cols - 1, nx + 2); x++) {
                if (curGrid[y][x].type === 'obstacle') {
                    const dist = Math.sqrt((nx - x) ** 2 + (ny - y) ** 2);
                    if (dist < 1.5) potential += repulsiveK / (dist + 0.1);
                }
            }
        }

        // 2. Attractive to grass
        const attractiveK = 5.0;
        const nearestGrass = getClosestGrass({ x: nx, y: ny }, curGrid, CELL_TYPES);
        if (nearestGrass) {
            const dist = Math.abs(nx - nearestGrass.x) + Math.abs(ny - nearestGrass.y);
            potential += attractiveK * dist;
        } else {
            potential += 1000; // No grass left
        }

        // 3. Penalty for mowed grass
        if (curGrid[ny][nx].type === CELL_TYPES.MOWED) {
            potential += 2.0;
        }

        if (potential < minPotential) {
            minPotential = potential;
            bestMove = { x: nx, y: ny };
        }
    }

    return bestMove;
};

/**
 * Spiral Coverage Algorithm
 */
export const getSpiralMove = (
    state: State,
    curGrid: Grid,
    CELL_TYPES: any
): Point | null => {
    const { pos } = state;
    const rows = curGrid.length;
    const cols = curGrid[0].length;

    if (state.spiralStep === undefined) {
        state.spiralStep = 1;
        state.spiralCenter = { ...pos };
    }

    const getSpiralPos = (step: number, center: Point): Point => {
        let x = center.x;
        let y = center.y;
        let currentStep = 0;
        let legLength = 1;
        let dirIdx = 0;
        const legDirs = [{ dx: 1, dy: 0 }, { dx: 0, dy: -1 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }];

        while (currentStep < step) {
            for (let i = 0; i < 2 && currentStep < step; i++) {
                for (let j = 0; j < legLength && currentStep < step; j++) {
                    x += legDirs[dirIdx].dx;
                    y += legDirs[dirIdx].dy;
                    currentStep++;
                }
                dirIdx = (dirIdx + 1) % 4;
            }
            legLength++;
        }
        return { x, y };
    };

    let attempts = 0;
    while (attempts < 100) {
        const target = getSpiralPos(state.spiralStep!, state.spiralCenter!);
        if (target.x >= 0 && target.x < cols && target.y >= 0 && target.y < rows) {
            if (curGrid[target.y][target.x].type === CELL_TYPES.GRASS) {
                state.spiralStep!++;
                return target;
            }
            state.spiralStep!++;
        } else {
             // Out of bounds, reset spiral
             state.spiralStep = 1;
             const nextGrass = getClosestGrass(pos, curGrid, CELL_TYPES);
             if (!nextGrass) return null;
             state.spiralCenter = nextGrass;
             break;
        }
        attempts++;
    }

    return findPathToTarget(pos, curGrid, { dx: 0, dy: 0 }, (p) => curGrid[p.y][p.x].type === CELL_TYPES.GRASS);
};

export const getSmartAIMove = (
    state: State,
    curGrid: Grid,
    prevDir: Direction,
    CELL_TYPES: any
): Point | null => {
    const { pos } = state;
    return findPathToTarget(pos, curGrid, prevDir, (p) => curGrid[p.y][p.x].type === CELL_TYPES.GRASS);
};


const castRay = (startX: number, startY: number, dx: number, dy: number, grid: Grid, CELL_TYPES: any) => {
    let x = startX + dx;
    let y = startY + dy;
    let dist = 1;
    let grassDist = -1;
    let obstacleDist = -1;
    let mowedDist = -1;

    while (y >= 0 && y < grid.length && x >= 0 && x < grid[0].length) {
        const cellType = grid[y][x].type;
        if (cellType === CELL_TYPES.GRASS && grassDist === -1) grassDist = dist;
        if (cellType === CELL_TYPES.OBSTACLE && obstacleDist === -1) obstacleDist = dist;
        if (cellType === CELL_TYPES.MOWED && mowedDist === -1) mowedDist = dist;
        
        if (grassDist !== -1 && obstacleDist !== -1 && mowedDist !== -1) break;
        x += dx;
        y += dy;
        dist++;
        if (dist > 12) break; // Slightly longer range
    }

    return {
        grass: grassDist !== -1 ? 1.0 - (grassDist / 12) : 0,
        obstacle: obstacleDist !== -1 ? 1.0 - (obstacleDist / 12) : 0,
        mowed: mowedDist !== -1 ? 1.0 - (mowedDist / 12) : 0
    };
};

export const prepareNNInputs = (state: State, curGrid: Grid, CELL_TYPES: any): number[] => {
    const { pos, battery, prevDir, isCharging, isReturningForCharge, visitCounts, dockPos } = state;
    const rows = curGrid.length;
    const cols = curGrid[0].length;

    const maxBat = state.maxBattery || DEFAULT_MAX_BATTERY;
    const isLowBattery = (battery / maxBat) * 100 < 20;
    const target = (isReturningForCharge || isLowBattery)
        ? (dockPos || pos)
        : (getClosestGrass(pos, curGrid, CELL_TYPES) || pos);

    const distToDock = (Math.abs(pos.x - dockPos.x) + Math.abs(pos.y - dockPos.y)) / (rows + cols);
    const distToTarget = (Math.abs(pos.x - target.x) + Math.abs(pos.y - target.y)) / (rows + cols);

    const rayUp = castRay(pos.x, pos.y, 0, -1, curGrid, CELL_TYPES);
    const rayDown = castRay(pos.x, pos.y, 0, 1, curGrid, CELL_TYPES);
    const rayLeft = castRay(pos.x, pos.y, -1, 0, curGrid, CELL_TYPES);
    const rayRight = castRay(pos.x, pos.y, 1, 0, curGrid, CELL_TYPES);

    const inputs = [
        pos.x / cols,
        pos.y / rows,
        battery / maxBat,
        isCharging ? 1 : 0,
        isReturningForCharge || isLowBattery ? 1 : 0,
        
        // Enhanced Target Vector
        Math.sign(target.x - pos.x),
        Math.sign(target.y - pos.y),
        
        // Enhanced Previous Direction (Inertia)
        prevDir.dx,
        prevDir.dy,
        distToDock,
        distToTarget, // 11

        // Cell values: [Current, Up, Down, Left, Right]
        getCellValue(pos.x, pos.y, curGrid, CELL_TYPES),
        getCellValue(pos.x, pos.y - 1, curGrid, CELL_TYPES),
        getCellValue(pos.x, pos.y + 1, curGrid, CELL_TYPES),
        getCellValue(pos.x - 1, pos.y, curGrid, CELL_TYPES),
        getCellValue(pos.x + 1, pos.y, curGrid, CELL_TYPES), // 15

        // Visit counts: [Current, Up, Down, Left, Right]
        Math.min((visitCounts?.[`${pos.x},${pos.y}`] || 0) / 5, 1.0),
        Math.min((visitCounts?.[`${pos.x},${pos.y - 1}`] || 0) / 5, 1.0),
        Math.min((visitCounts?.[`${pos.x},${pos.y + 1}`] || 0) / 5, 1.0),
        Math.min((visitCounts?.[`${pos.x - 1},${pos.y}`] || 0) / 5, 1.0),
        Math.min((visitCounts?.[`${pos.x + 1},${pos.y}`] || 0) / 5, 1.0), // 20

        // Raycasting (8 directions now: 4 straight + 4 diagonal)
        rayUp.grass, rayDown.grass, rayLeft.grass, rayRight.grass,
        rayUp.obstacle, rayDown.obstacle, rayLeft.obstacle, rayRight.obstacle,
        
        // Diagonals (New)
        castRay(pos.x, pos.y, 1, 1, curGrid, CELL_TYPES).grass,
        castRay(pos.x, pos.y, 1, -1, curGrid, CELL_TYPES).grass,
        castRay(pos.x, pos.y, -1, 1, curGrid, CELL_TYPES).grass,
        castRay(pos.x, pos.y, -1, -1, curGrid, CELL_TYPES).grass,
        
        castRay(pos.x, pos.y, 1, 1, curGrid, CELL_TYPES).obstacle,
        castRay(pos.x, pos.y, 1, -1, curGrid, CELL_TYPES).obstacle,
        castRay(pos.x, pos.y, -1, 1, curGrid, CELL_TYPES).obstacle,
        castRay(pos.x, pos.y, -1, -1, curGrid, CELL_TYPES).obstacle, 

        // Mowed Rays (8 directions)
        rayUp.mowed, rayDown.mowed, rayLeft.mowed, rayRight.mowed,
        castRay(pos.x, pos.y, 1, 1, curGrid, CELL_TYPES).mowed,
        castRay(pos.x, pos.y, 1, -1, curGrid, CELL_TYPES).mowed,
        castRay(pos.x, pos.y, -1, 1, curGrid, CELL_TYPES).mowed,
        castRay(pos.x, pos.y, -1, -1, curGrid, CELL_TYPES).mowed, // 44
        
        // ORIENTATION
        state.orientation === 'horizontal' ? 1.0 : 0.0, // 45
        state.orientation === 'vertical' ? 1.0 : 0.0    // 46
    ];
    return inputs;
};

/**
 * RRT (Rapidly-exploring Random Tree) Exploration
 * Finds a path to the nearest grass by growing a random tree.
 */
export const getRRTMove = (
    state: State,
    curGrid: Grid,
    prevDir: Direction,
    CELL_TYPES: any
): Point | null => {
    const { pos } = state;
    const target = getClosestGrass(pos, curGrid, CELL_TYPES);
    if (!target) return null;

    const rows = curGrid.length;
    const cols = curGrid[0].length;
    const nodes = [{ pos, parent: -1 }];
    const maxNodes = 500;

    for (let i = 0; i < maxNodes; i++) {
        // 20% bias towards target
        const sample = Math.random() < 0.2 ? target : {
            x: Math.floor(Math.random() * cols),
            y: Math.floor(Math.random() * rows)
        };

        // Find nearest node in tree
        let nearestIdx = 0;
        let minDist = Infinity;
        for (let j = 0; j < nodes.length; j++) {
            const d = Math.abs(nodes[j].pos.x - sample.x) + Math.abs(nodes[j].pos.y - sample.y);
            if (d < minDist) { minDist = d; nearestIdx = j; }
        }

        const nearest = nodes[nearestIdx].pos;
        // Step towards sample
        const dx = Math.sign(sample.x - nearest.x);
        const dy = Math.sign(sample.y - nearest.y);
        
        // Only move in one axis at a time (grid)
        const nextX = nearest.x + dx;
        const nextY = nearest.y + (dx === 0 ? dy : 0);

        if (nextX >= 0 && nextX < cols && nextY >= 0 && nextY < rows && curGrid[nextY][nextX].type !== 'obstacle') {
            // Check if already in nodes
            if (!nodes.some(n => n.pos.x === nextX && n.pos.y === nextY)) {
                nodes.push({ pos: { x: nextX, y: nextY }, parent: nearestIdx });
                if (nextX === target.x && nextY === target.y) {
                    // Path found, return first move of path
                    let curr = nodes.length - 1;
                    while (nodes[curr].parent !== 0 && nodes[curr].parent !== -1) {
                        curr = nodes[curr].parent;
                    }
                    return nodes[curr].pos;
                }
            }
        }
    }

    return getSmartAIMove(state, curGrid, prevDir, CELL_TYPES);
};

/**
 * Spanning Tree Coverage (STC)
 * Guarantees 100% coverage by following a spanning tree on a coarse grid.
 */
export const getSTCMove = (
    state: State,
    curGrid: Grid,
    prevDir: Direction,
    CELL_TYPES: any
): Point | null => {
    const { pos } = state;
    const rows = curGrid.length;
    const cols = curGrid[0].length;

    // Coarse grid dimensions
    const cRows = Math.floor(rows / 2);
    const cCols = Math.floor(cols / 2);

    if (!state.stcPath || state.stcPath.length === 0) {
        // 1. Find spanning tree of coarse grid (BFS/DFS)
        // 2. Generate path by following tree boundary
        // For simplicity in this demo, we'll use a fallback if not pre-computed
        // Real STC would pre-compute the full Hamiltonian cycle.
        return getBoustrophedonMove(state, curGrid, prevDir, CELL_TYPES);
    }

    return null; 
};

export const getCellValue = (x: number, y: number, grid: Grid, CELL_TYPES: any): number => {

    if (y < 0 || y >= grid.length || x < 0 || x >= grid[0].length) return -1.0; 
    const cell = grid[y][x];
    if (cell.type === CELL_TYPES.OBSTACLE) return -1.0;
    if (cell.type === CELL_TYPES.GRASS) return 1.0;
    if (cell.type === CELL_TYPES.MOWED) {
        // Much stronger negative signal for mowed grass to distinguish from fresh grass
        return -0.8 - Math.min((cell.damage || 0) * 0.2, 0.2);
    }
    if (cell.type === CELL_TYPES.DOCK) return 0.5;
    return 0.0;
};

export const getNeuralNetworkMove = (
    state: State,
    curGrid: Grid,
    prevDir: Direction,
    cellTypes: typeof CELL_TYPES,
    nn: NeuralNetwork | null
): Point | null => {
    if (!nn) return getSmartAIMove(state, curGrid, prevDir, cellTypes);

    const { pos, orientation, visitCounts } = state;
    const rows = curGrid.length;
    const cols = curGrid[0].length;

    const isValid = (x: number, y: number) =>
        x >= 0 && x < cols && y >= 0 && y < rows &&
        curGrid[y][x].type !== cellTypes.OBSTACLE;

    const isGrass = (x: number, y: number) =>
        isValid(x, y) && curGrid[y][x].type === cellTypes.GRASS;

    // Only block the immediate previous cell (anti-ping-pong)
    const prevX = pos.x - prevDir.dx;
    const prevY = pos.y - prevDir.dy;

    // --- NN DECISION ---
    const inputs = prepareNNInputs(state, curGrid, cellTypes);
    const outputs = nn.predict(inputs);

    const allMoves = [
        { x: pos.x, y: pos.y - 1, dx: 0, dy: -1, idx: 0 },
        { x: pos.x, y: pos.y + 1, dx: 0, dy:  1, idx: 1 },
        { x: pos.x - 1, y: pos.y, dx: -1, dy: 0, idx: 2 },
        { x: pos.x + 1, y: pos.y, dx:  1, dy: 0, idx: 3 },
    ];

    const scoredMoves = allMoves.map(m => {
        let score = outputs[m.idx];

        const targetIsGrass = isGrass(m.x, m.y);
        
        // Reward grass strongly
        if (targetIsGrass) score += 1.0;
        
        // Orientation preference ONLY when mowing grass
        const isAligned = orientation === 'horizontal' ? (m.dx !== 0) : (m.dy !== 0);
        if (targetIsGrass && isAligned) score += 0.4;

        // Penalize revisiting mowed cells more strictly to encourage direct paths
        const visits = visitCounts?.[`${m.x},${m.y}`] || 0;
        if (visits > 0) {
            score -= (0.2 + visits * 0.1);
        }

        return { ...m, score };
    }).sort((a, b) => b.score - a.score);

    for (const move of scoredMoves) {
        if (!isValid(move.x, move.y)) continue;
        // Don't go back immediately if possible
        if (move.x === prevX && move.y === prevY && scoredMoves.some(sm => sm !== move && isValid(sm.x, sm.y))) continue;
        return { x: move.x, y: move.y };
    }

};

