import { CELL_TYPES, DEFAULT_MAX_BATTERY } from '../constants';
import { NeuralNetwork } from '../NeuralNetwork';
import type { Grid, PositionType as Point, Direction, State } from '../types';
import { getClosestGrass } from './pathfinding';
import { getSmartAIMove } from './smartAI';

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

    const isValid = (x: number, y: number): boolean =>
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

    return null;
};
