import { DEFAULT_MAX_BATTERY } from './constants';
import { NeuralNetwork } from './NeuralNetwork';
import type { Grid, PositionType as Point, Direction, State } from './types';

export const findFullPathToTarget = (
    start: Point,
    currentGrid: Grid,
    currentDir: Direction,
    targetPredicate: (p: Point) => boolean
): Point[] | null => {
    const rows = currentGrid.length;
    const cols = currentGrid[0].length;
    const openSet = [{ pos: start, path: [] as Point[], cost: 0, dir: currentDir }];
    const visited = new Set<string>();
    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    while (openSet.length > 0) {
        openSet.sort((a, b) => a.cost - b.cost);
        const curr = openSet.shift()!;
        const { x, y } = curr.pos;
        const stateKey = `${x},${y},${curr.dir.dx},${curr.dir.dy}`;
        if (visited.has(stateKey)) continue;
        visited.add(stateKey);
        if (targetPredicate(curr.pos) && (x !== start.x || y !== start.y)) return curr.path;
        for (const [dx, dy] of dirs) {
            const nextX = x + dx;
            const nextY = y + dy;
            if (nextX >= 0 && nextX < cols && nextY >= 0 && nextY < rows && currentGrid[nextY][nextX].type !== 'obstacle') {
                const isTurn = dx !== curr.dir.dx || dy !== curr.dir.dy;
                const moveCost = 1 + (isTurn ? 5 : 0);
                openSet.push({
                    pos: { x: nextX, y: nextY },
                    path: [...curr.path, { x: nextX, y: nextY }],
                    cost: curr.cost + moveCost,
                    dir: { dx, dy }
                });
            }
        }
        if (openSet.length > 5000) break;
    }
    return null;
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

export const getZigzagMove = (
    state: State,
    curGrid: Grid,
    prevDir: Direction,
    rows: number,
    cols: number,
    CELL_TYPES: any,
    orientation: string = 'vertical'
): Point | null => {
    const { pos } = state;
    const getSequencePos = (idx: number): Point => {
        if (orientation === 'vertical') {
            const col = Math.floor(idx / rows);
            const rowInCol = idx % rows;
            const row = col % 2 === 0 ? rowInCol : (rows - 1 - rowInCol);
            return { x: col, y: row };
        } else {
            const row = Math.floor(idx / cols);
            const colInRow = idx % cols;
            const col = row % 2 === 0 ? colInRow : (cols - 1 - colInRow);
            return { x: col, y: row };
        }
    };

    if (state.zigzagIdx === undefined) state.zigzagIdx = 0;

    while (state.zigzagIdx < rows * cols) {
        const target = getSequencePos(state.zigzagIdx);
        if (target.x === pos.x && target.y === pos.y) { state.zigzagIdx++; continue; }
        if (curGrid[target.y][target.x].type !== CELL_TYPES.GRASS) { state.zigzagIdx++; continue; }
        const move = findPathToTarget(pos, curGrid, prevDir, (p) => p.x === target.x && p.y === target.y);
        if (move) return move;
        state.zigzagIdx++;
    }
    return null;
};

export const getUShapeMove = (
    state: State,
    curGrid: Grid,
    prevDir: Direction,
    rows: number,
    cols: number,
    CELL_TYPES: any,
    orientation: string = 'horizontal'
): Point | null => {
    const { pos } = state;
    const getUShapePos = (idx: number): Point => {
        if (orientation === 'horizontal') {
            const row = Math.floor(idx / cols);
            const colInRow = idx % cols;
            const col = row % 2 === 0 ? colInRow : (cols - 1 - colInRow);
            return { x: col, y: row };
        } else {
            const col = Math.floor(idx / rows);
            const rowInCol = idx % rows;
            const row = col % 2 === 0 ? rowInCol : (rows - 1 - rowInCol);
            return { x: col, y: row };
        }
    };

    if (state.uShapeIdx === undefined) state.uShapeIdx = 0;

    while (state.uShapeIdx < rows * cols) {
        const target = getUShapePos(state.uShapeIdx);
        if (target.x === pos.x && target.y === pos.y) { state.uShapeIdx++; continue; }
        if (curGrid[target.y][target.x].type !== CELL_TYPES.GRASS) { state.uShapeIdx++; continue; }
        const move = findPathToTarget(pos, curGrid, prevDir, (p) => p.x === target.x && p.y === target.y);
        if (move) return move;
        state.uShapeIdx++;
    }
    return null;
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

export const getSLAMBoustrophedonMove = (
    state: State,
    curGrid: Grid,
    prevDir: Direction,
    rows: number,
    cols: number,
    CELL_TYPES: any,
    orientation: string = 'vertical'
): Point | null => {
    const { pos } = state;
    if (state.slamDir === undefined) {
        state.slamDir = 1;
    }

    const isVert = orientation === 'vertical';

    const allGrass: Point[] = [];
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            if (curGrid[y][x].type === CELL_TYPES.GRASS) {
                allGrass.push({ x, y });
            }
        }
    }

    if (allGrass.length === 0) return null;

    let target: Point | null = null;
    const grassInLine = allGrass.filter(g => isVert ? g.x === pos.x : g.y === pos.y);

    if (grassInLine.length > 0) {
        const forwardGrass = grassInLine.filter(g => {
            if (isVert) return (state.slamDir === 1 ? g.y > pos.y : g.y < pos.y);
            return (state.slamDir === 1 ? g.x > pos.x : g.x < pos.x);
        });

        if (forwardGrass.length > 0) {
            forwardGrass.sort((a, b) => {
                if (isVert) return Math.abs(a.y - pos.y) - Math.abs(b.y - pos.y);
                return Math.abs(a.x - pos.x) - Math.abs(b.x - pos.x);
            });
            target = forwardGrass[0];
        } else {
            state.slamDir *= -1;
            grassInLine.sort((a, b) => {
                if (isVert) return Math.abs(a.y - pos.y) - Math.abs(b.y - pos.y);
                return Math.abs(a.x - pos.x) - Math.abs(b.x - pos.x);
            });
            target = grassInLine[0];
        }
    } else {
        allGrass.sort((a, b) => {
            if (isVert) {
                const colDiff = Math.abs(a.x - pos.x) - Math.abs(b.x - pos.x);
                if (colDiff !== 0) return colDiff;
                return Math.abs(a.y - pos.y) - Math.abs(b.y - pos.y);
            } else {
                const rowDiff = Math.abs(a.y - pos.y) - Math.abs(b.y - pos.y);
                if (rowDiff !== 0) return rowDiff;
                return Math.abs(a.x - pos.x) - Math.abs(b.x - pos.x);
            }
        });

        const nextCoord = isVert ? allGrass[0].x : allGrass[0].y;
        const grassInNextLine = allGrass.filter(g => isVert ? g.x === nextCoord : g.y === nextCoord);
        grassInNextLine.sort((a, b) => {
            if (isVert) return Math.abs(a.y - pos.y) - Math.abs(b.y - pos.y);
            return Math.abs(a.x - pos.x) - Math.abs(b.x - pos.x);
        });
        target = grassInNextLine[0];

        const maxVal = Math.max(...grassInNextLine.map(g => isVert ? g.y : g.x));
        const minVal = Math.min(...grassInNextLine.map(g => isVert ? g.y : g.x));
        const currVal = isVert ? target.y : target.x;

        if (Math.abs(currVal - minVal) < Math.abs(currVal - maxVal)) {
            state.slamDir = 1;
        } else {
            state.slamDir = -1;
        }
    }

    if (target) {
        const move = findPathToTarget(pos, curGrid, prevDir, (p) => p.x === target!.x && p.y === target!.y);
        if (move) return move;
        return getSmartAIMove(state, curGrid, prevDir, CELL_TYPES);
    }

    return null;
};

export const getCellularBoustrophedonMove = (
    state: State,
    curGrid: Grid,
    prevDir: Direction,
    rows: number,
    cols: number,
    CELL_TYPES: any,
    orientation: string = 'vertical'
): Point | null => {
    const { pos } = state;

    if (!state.cellData) {
        state.cellData = {
            sweepDir: 1,
            cellScanDir: 1
        };
    }

    const { cellData } = state;
    const isVert = orientation === 'vertical';

    // Helper: Find grass in current line (row or col) contiguous with current position
    const getContiguousGrassInLine = (x: number, y: number): Point[] => {
        const grass: Point[] = [];
        if (isVert) {
            for (let currY = y; currY < rows; currY++) {
                if (curGrid[currY][x].type === CELL_TYPES.GRASS) grass.push({ x, y: currY });
                else if (curGrid[currY][x].type === 'obstacle') break;
            }
            for (let currY = y - 1; currY >= 0; currY--) {
                if (curGrid[currY][x].type === CELL_TYPES.GRASS) grass.push({ x, y: currY });
                else if (curGrid[currY][x].type === 'obstacle') break;
            }
        } else {
            for (let currX = x; currX < cols; currX++) {
                if (curGrid[y][currX].type === CELL_TYPES.GRASS) grass.push({ x: currX, y });
                else if (curGrid[y][currX].type === 'obstacle') break;
            }
            for (let currX = x - 1; currX >= 0; currX--) {
                if (curGrid[y][currX].type === CELL_TYPES.GRASS) grass.push({ x: currX, y });
                else if (curGrid[y][currX].type === 'obstacle') break;
            }
        }
        return grass;
    };

    // 1. Try to continue current sweep
    const grassInLine = getContiguousGrassInLine(pos.x, pos.y);
    if (grassInLine.length > 0) {
        const forwardGrass = grassInLine.filter(g => {
            if (isVert) return (cellData.sweepDir === 1 ? g.y > pos.y : g.y < pos.y);
            return (cellData.sweepDir === 1 ? g.x > pos.x : g.x < pos.x);
        });
        if (forwardGrass.length > 0) {
            forwardGrass.sort((a, b) => {
                if (isVert) return Math.abs(a.y - pos.y) - Math.abs(b.y - pos.y);
                return Math.abs(a.x - pos.x) - Math.abs(b.x - pos.x);
            });
            const target = forwardGrass[0];
            return findPathToTarget(pos, curGrid, prevDir, (p) => p.x === target.x && p.y === target.y);
        }
    }

    // 2. Line finished, move to adjacent line
    const nextX = isVert ? pos.x + cellData.cellScanDir : pos.x;
    const nextY = isVert ? pos.y : pos.y + cellData.cellScanDir;

    if (nextX >= 0 && nextX < cols && nextY >= 0 && nextY < rows) {
        if (curGrid[nextY][nextX].type === CELL_TYPES.GRASS) {
            cellData.sweepDir *= -1;
            return findPathToTarget(pos, curGrid, prevDir, (p) => p.x === nextX && p.y === nextY);
        }
        // Try neighbor cells in next line
        const neighbors = isVert ?
            [{ x: nextX, y: pos.y - 1 }, { x: nextX, y: pos.y + 1 }] :
            [{ x: pos.x - 1, y: nextY }, { x: pos.x + 1, y: nextY }];

        for (const n of neighbors) {
            if (n.x >= 0 && n.x < cols && n.y >= 0 && n.y < rows && curGrid[n.y][n.x].type === CELL_TYPES.GRASS) {
                cellData.sweepDir *= -1;
                return findPathToTarget(pos, curGrid, prevDir, (p) => p.x === n.x && p.y === n.y);
            }
        }
    }

    // 3. Change horizontal/vertical scan direction
    cellData.cellScanDir *= -1;

    // 4. Fallback
    const closestGrass = findPathToTarget(pos, curGrid, prevDir, (p) => curGrid[p.y][p.x].type === CELL_TYPES.GRASS);
    if (closestGrass) return closestGrass;

    return null;
};

// --- ALGORITHMS ---

export const aStarSearch = (
    start: Point,
    target: Point,
    currentGrid: Grid,
    currentDir: Direction
): Point | null => {
    const rows = currentGrid.length;
    const cols = currentGrid[0].length;
    const heuristic = (p1: Point, p2: Point) => Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y);
    const openSet = [{ pos: start, path: [] as Point[], g: 0, f: heuristic(start, target), dir: currentDir }];
    const visited = new Set<string>();
    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];

    while (openSet.length > 0) {
        openSet.sort((a, b) => a.f - b.f);
        const curr = openSet.shift()!;
        const { x, y } = curr.pos;
        const stateKey = `${x},${y},${curr.dir.dx},${curr.dir.dy}`;

        if (visited.has(stateKey)) continue;
        visited.add(stateKey);

        if (x === target.x && y === target.y && (x !== start.x || y !== start.y)) return curr.path[0];

        for (const [dx, dy] of dirs) {
            const nextX = x + dx;
            const nextY = y + dy;
            if (nextX >= 0 && nextX < cols && nextY >= 0 && nextY < rows && currentGrid[nextY][nextX].type !== 'obstacle') {
                const isTurn = dx !== curr.dir.dx || dy !== curr.dir.dy;
                const g = curr.g + 1 + (isTurn ? 5 : 0);
                const h = heuristic({ x: nextX, y: nextY }, target);
                openSet.push({
                    pos: { x: nextX, y: nextY },
                    path: [...curr.path, { x: nextX, y: nextY }],
                    g, f: g + h, dir: { dx, dy }
                });
            }
        }
    }
    return null;
};

export const dijkstraSearch = (
    start: Point,
    targetPredicate: (p: Point) => boolean,
    currentGrid: Grid,
    currentDir: Direction
): Point | null => {
    const rows = currentGrid.length;
    const cols = currentGrid[0].length;
    const openSet = [{ pos: start, path: [] as Point[], cost: 0, dir: currentDir }];
    const visited = new Set<string>();
    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];

    while (openSet.length > 0) {
        openSet.sort((a, b) => a.cost - b.cost);
        const curr = openSet.shift()!;
        const { x, y } = curr.pos;
        const stateKey = `${x},${y},${curr.dir.dx},${curr.dir.dy}`;

        if (visited.has(stateKey)) continue;
        visited.add(stateKey);

        if (targetPredicate(curr.pos) && (x !== start.x || y !== start.y)) return curr.path[0];

        for (const [dx, dy] of dirs) {
            const nextX = x + dx;
            const nextY = y + dy;
            if (nextX >= 0 && nextX < cols && nextY >= 0 && nextY < rows && currentGrid[nextY][nextX].type !== 'obstacle') {
                const isTurn = dx !== curr.dir.dx || dy !== curr.dir.dy;
                openSet.push({
                    pos: { x: nextX, y: nextY },
                    path: [...curr.path, { x: nextX, y: nextY }],
                    cost: curr.cost + 1 + (isTurn ? 5 : 0), dir: { dx, dy }
                });
            }
        }
    }
    return null;
};

export const bfsSearch = (
    start: Point,
    targetPredicate: (p: Point) => boolean,
    currentGrid: Grid
): Point | null => {
    const rows = currentGrid.length;
    const cols = currentGrid[0].length;
    const queue = [{ pos: start, path: [] as Point[] }];
    const visited = new Set<string>();
    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];

    while (queue.length > 0) {
        const curr = queue.shift()!;
        const { x, y } = curr.pos;
        const stateKey = `${x},${y}`;

        if (visited.has(stateKey)) continue;
        visited.add(stateKey);

        if (targetPredicate(curr.pos) && (x !== start.x || y !== start.y)) return curr.path[0];

        for (const [dx, dy] of dirs) {
            const nextX = x + dx;
            const nextY = y + dy;
            if (nextX >= 0 && nextX < cols && nextY >= 0 && nextY < rows && currentGrid[nextY][nextX].type !== 'obstacle') {
                queue.push({
                    pos: { x: nextX, y: nextY },
                    path: [...curr.path, { x: nextX, y: nextY }]
                });
            }
        }
    }
    return null;
};

export const greedyBestFirstSearch = (
    start: Point,
    target: Point,
    currentGrid: Grid,
    currentDir: Direction
): Point | null => {
    const rows = currentGrid.length;
    const cols = currentGrid[0].length;
    const heuristic = (p1: Point, p2: Point) => Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y);
    const openSet = [{ pos: start, path: [] as Point[], h: heuristic(start, target), dir: currentDir }];
    const visited = new Set<string>();
    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];

    while (openSet.length > 0) {
        openSet.sort((a, b) => a.h - b.h);
        const curr = openSet.shift()!;
        const { x, y } = curr.pos;
        const stateKey = `${x},${y},${curr.dir.dx},${curr.dir.dy}`;

        if (visited.has(stateKey)) continue;
        visited.add(stateKey);

        if (x === target.x && y === target.y && (x !== start.x || y !== start.y)) return curr.path[0];

        for (const [dx, dy] of dirs) {
            const nextX = x + dx;
            const nextY = y + dy;
            if (nextX >= 0 && nextX < cols && nextY >= 0 && nextY < rows && currentGrid[nextY][nextX].type !== 'obstacle') {
                openSet.push({
                    pos: { x: nextX, y: nextY },
                    path: [...curr.path, { x: nextX, y: nextY }],
                    h: heuristic({ x: nextX, y: nextY }, target), dir: { dx, dy }
                });
            }
        }
    }
    return null;
};

export const jpsSearch = (
    start: Point,
    target: Point,
    currentGrid: Grid
): Point | null => {
    return aStarSearch(start, target, currentGrid, { dx: 0, dy: 1 });
};

export const dStarLiteSearch = (
    start: Point,
    target: Point,
    currentGrid: Grid,
    currentDir: Direction
): Point | null => {
    const rows = currentGrid.length;
    const cols = currentGrid[0].length;
    const heuristic = (p1: Point, p2: Point) => Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y);
    const openSet = [{ pos: start, path: [] as Point[], g: 0, f: heuristic(start, target), dir: currentDir }];
    const visited = new Set<string>();
    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];

    while (openSet.length > 0) {
        openSet.sort((a, b) => a.f - b.f);
        const curr = openSet.shift()!;
        const { x, y } = curr.pos;
        const stateKey = `${x},${y},${curr.dir.dx},${curr.dir.dy}`;

        if (visited.has(stateKey)) continue;
        visited.add(stateKey);

        if (x === target.x && y === target.y && (x !== start.x || y !== start.y)) return curr.path[0];

        for (const [dx, dy] of dirs) {
            const nextX = x + dx;
            const nextY = y + dy;
            if (nextX >= 0 && nextX < cols && nextY >= 0 && nextY < rows && currentGrid[nextY][nextX].type !== 'obstacle') {
                const isTurn = dx !== curr.dir.dx || dy !== curr.dir.dy;
                const dynamicCost = currentGrid[nextY][nextX].type === 'mowed' ? 3 : 1;
                const g = curr.g + dynamicCost + (isTurn ? 5 : 0);
                const h = heuristic({ x: nextX, y: nextY }, target);
                openSet.push({
                    pos: { x: nextX, y: nextY },
                    path: [...curr.path, { x: nextX, y: nextY }],
                    g, f: g + h, dir: { dx, dy }
                });
            }
        }
    }
    return null;
};

const getClosestGrass = (pos: Point, grid: Grid, CELL_TYPES: any): Point | null => {
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

export const getAStarMove = (state: State, curGrid: Grid, prevDir: Direction, CELL_TYPES: any): Point | null => {
    const target = getClosestGrass(state.pos, curGrid, CELL_TYPES);
    if (!target) return null;
    return aStarSearch(state.pos, target, curGrid, prevDir);
};

export const getDijkstraMove = (state: State, curGrid: Grid, prevDir: Direction, CELL_TYPES: any): Point | null => {
    return dijkstraSearch(state.pos, (p) => curGrid[p.y][p.x].type === CELL_TYPES.GRASS, curGrid, prevDir);
};

export const getBFSMove = (state: State, curGrid: Grid, _prevDir: Direction, CELL_TYPES: any): Point | null => {
    return bfsSearch(state.pos, (p) => curGrid[p.y][p.x].type === CELL_TYPES.GRASS, curGrid);
};

export const getGreedyBestFirstMove = (state: State, curGrid: Grid, prevDir: Direction, CELL_TYPES: any): Point | null => {
    const target = getClosestGrass(state.pos, curGrid, CELL_TYPES);
    if (!target) return null;
    return greedyBestFirstSearch(state.pos, target, curGrid, prevDir);
};

export const getJPSMove = (state: State, curGrid: Grid, _prevDir: Direction, CELL_TYPES: any): Point | null => {
    const target = getClosestGrass(state.pos, curGrid, CELL_TYPES);
    if (!target) return null;
    return jpsSearch(state.pos, target, curGrid);
};

export const getDStarLiteMove = (state: State, curGrid: Grid, prevDir: Direction, CELL_TYPES: any): Point | null => {
    const target = getClosestGrass(state.pos, curGrid, CELL_TYPES);
    if (!target) return null;
    return dStarLiteSearch(state.pos, target, curGrid, prevDir);
};

export const getCustomMove = (state: State, curGrid: Grid, prevDir: Direction, CELL_TYPES: any): Point | null => {
    const { pos } = state;
    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    const rows = curGrid.length;
    const cols = curGrid[0].length;

    const nextX = pos.x + prevDir.dx;
    const nextY = pos.y + prevDir.dy;

    if (nextX >= 0 && nextX < cols && nextY >= 0 && nextY < rows && curGrid[nextY][nextX].type === CELL_TYPES.GRASS) {
        return { x: nextX, y: nextY };
    }

    for (const [dx, dy] of dirs) {
        const nx = pos.x + dx;
        const ny = pos.y + dy;
        if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && curGrid[ny][nx].type === CELL_TYPES.GRASS) {
            return { x: nx, y: ny };
        }
    }

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
        
        // Sustiprintas tikslo vektorius (Target Vector)
        Math.sign(target.x - pos.x),
        Math.sign(target.y - pos.y),
        
        // Sustiprinta ankstesnė kryptis (Inercija)
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
        
        // ORIENTACIJA
        state.orientation === 'horizontal' ? 1.0 : 0.0, // 45
        state.orientation === 'vertical' ? 1.0 : 0.0    // 46
    ];
    return inputs;
};

const getCellValue = (x: number, y: number, grid: Grid, CELL_TYPES: any): number => {
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
    CELL_TYPES: any,
    nn: NeuralNetwork | null
): Point | null => {
    if (!nn) return getSmartAIMove(state, curGrid, prevDir, CELL_TYPES);

    const { pos, orientation, visitCounts } = state;
    const rows = curGrid.length;
    const cols = curGrid[0].length;

    const isValid = (x: number, y: number) =>
        x >= 0 && x < cols && y >= 0 && y < rows &&
        curGrid[y][x].type !== CELL_TYPES.OBSTACLE;

    const isGrass = (x: number, y: number) =>
        isValid(x, y) && curGrid[y][x].type === CELL_TYPES.GRASS;

    // Only block the immediate previous cell (anti-ping-pong, not too restrictive)
    const prevX = pos.x - prevDir.dx;
    const prevY = pos.y - prevDir.dy;

    // ── TIER 1: If there is fresh grass directly ahead in orientation direction, take it ──
    // This enforces the row-by-row pattern only when it's obviously the right move.
    if (orientation === 'horizontal') {
        // Continue in same horizontal direction if there's grass
        const fwd = { x: pos.x + prevDir.dx, y: pos.y };
        if (prevDir.dx !== 0 && isGrass(fwd.x, fwd.y)) return fwd;
        // Or check both horizontal options if not moving horizontally
        if (prevDir.dx === 0) {
            if (isGrass(pos.x + 1, pos.y)) return { x: pos.x + 1, y: pos.y };
            if (isGrass(pos.x - 1, pos.y)) return { x: pos.x - 1, y: pos.y };
        }
    } else {
        // Vertical orientation
        const fwd = { x: pos.x, y: pos.y + prevDir.dy };
        if (prevDir.dy !== 0 && isGrass(fwd.x, fwd.y)) return fwd;
        if (prevDir.dy === 0) {
            if (isGrass(pos.x, pos.y + 1)) return { x: pos.x, y: pos.y + 1 };
            if (isGrass(pos.x, pos.y - 1)) return { x: pos.x, y: pos.y - 1 };
        }
    }

    // ── TIER 2: NN decides with a soft orientation bias ──
    const inputs = prepareNNInputs(state, curGrid, CELL_TYPES);
    const outputs = nn.predict(inputs);

    const allMoves = [
        { x: pos.x, y: pos.y - 1, dx: 0, dy: -1, idx: 0 },
        { x: pos.x, y: pos.y + 1, dx: 0, dy:  1, idx: 1 },
        { x: pos.x - 1, y: pos.y, dx: -1, dy: 0, idx: 2 },
        { x: pos.x + 1, y: pos.y, dx:  1, dy: 0, idx: 3 },
    ];

    const scoredMoves = allMoves.map(m => {
        let score = outputs[m.idx];

        // Soft orientation preference (not a mandate)
        const isAligned = orientation === 'horizontal' ? (m.dx !== 0) : (m.dy !== 0);
        if (isAligned) score += 0.6;

        // Prefer grass over mowed
        if (isGrass(m.x, m.y)) score += 1.0;

        // Penalize frequently-visited cells
        const visits = visitCounts?.[`${m.x},${m.y}`] || 0;
        if (visits > 0) score -= visits * 0.25;

        return { ...m, score };
    }).sort((a, b) => b.score - a.score);

    // First pass: avoid going back to the immediate previous cell
    for (const move of scoredMoves) {
        if (!isValid(move.x, move.y)) continue;
        if (move.x === prevX && move.y === prevY) continue;
        return { x: move.x, y: move.y };
    }

    // Second pass: allow going back if truly stuck
    for (const move of scoredMoves) {
        if (isValid(move.x, move.y)) return { x: move.x, y: move.y };
    }

    return getSmartAIMove(state, curGrid, prevDir, CELL_TYPES);
};

