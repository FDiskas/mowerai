import { CELL_TYPES, DEFAULT_MAX_BATTERY } from '../constants';
import type { NeuralNetwork } from '../NeuralNetwork';
import type { Grid, PositionType as Point, Direction, State } from '../types';
import { getClosestGrass, findPathToTarget, findFullPathToTarget } from './pathfinding';
import { getSmartAIMove } from './smartAI';
import { turnCostOf } from './turnCost';

/** Rays see this many tiles; closer hits give values nearer to 1. */
const RAY_RANGE = 12;

const castRay = (startX: number, startY: number, dx: number, dy: number, grid: Grid, cellTypes: typeof CELL_TYPES) => {
    let x = startX + dx;
    let y = startY + dy;
    let dist = 1;
    let grassDist = -1;
    let obstacleDist = -1;
    let mowedDist = -1;

    while (y >= 0 && y < grid.length && x >= 0 && x < grid[0].length) {
        const cellType = grid[y][x].type;
        if (cellType === cellTypes.GRASS && grassDist === -1) grassDist = dist;
        if (cellType === cellTypes.OBSTACLE) {
            obstacleDist = dist;
            break; // Obstacle blocks the ray completely!
        }
        if (cellType === cellTypes.MOWED && mowedDist === -1) mowedDist = dist;

        x += dx;
        y += dy;
        dist++;
        if (dist > RAY_RANGE) break;
    }

    return {
        grass: grassDist !== -1 ? 1.0 - (grassDist / RAY_RANGE) : 0,
        obstacle: obstacleDist !== -1 ? 1.0 - (obstacleDist / RAY_RANGE) : 0,
        mowed: mowedDist !== -1 ? 1.0 - (mowedDist / RAY_RANGE) : 0
    };
};

export const getCellValue = (x: number, y: number, grid: Grid, cellTypes: typeof CELL_TYPES): number => {
    if (y < 0 || y >= grid.length || x < 0 || x >= grid[0].length) return -1.0;
    const cell = grid[y][x];
    if (cell.type === cellTypes.OBSTACLE) return -1.0;
    if (cell.type === cellTypes.GRASS) return 1.0;
    if (cell.type === cellTypes.MOWED) {
        // Much stronger negative signal for mowed grass to distinguish from fresh grass
        return -0.8 - Math.min(cell.damage * 0.2, 0.2);
    }
    if (cell.type === cellTypes.DOCK) return 0.5;
    return 0.0;
};

export const prepareNNInputs = (state: State, curGrid: Grid, cellTypes: typeof CELL_TYPES): number[] => {
    const { pos, battery, prevDir, isCharging, isReturningForCharge, visitCounts, dockPos } = state;
    const rows = curGrid.length;
    const cols = curGrid[0].length;

    const maxBat = state.maxBattery ?? DEFAULT_MAX_BATTERY;
    const isLowBattery = (battery / maxBat) * 100 < 20;
    const needsDocking = isReturningForCharge || isLowBattery;

    // Use A* pathfinding to find the actual next step towards target to guide the NN around obstacles
    const isTarget = needsDocking
        ? (p: Point) => p.x === dockPos.x && p.y === dockPos.y
        : (p: Point) => curGrid[p.y][p.x].type === cellTypes.GRASS;
    const nextStep = findFullPathToTarget(pos, curGrid, prevDir, isTarget, turnCostOf(state))?.[0] ?? pos;
    const targetDirX = nextStep.x - pos.x;
    const targetDirY = nextStep.y - pos.y;

    const target = needsDocking ? dockPos : (getClosestGrass(pos, curGrid, cellTypes) ?? pos);
    const distToDock = (Math.abs(pos.x - dockPos.x) + Math.abs(pos.y - dockPos.y)) / (rows + cols);
    const distToTarget = (Math.abs(pos.x - target.x) + Math.abs(pos.y - target.y)) / (rows + cols);

    const ray = (dx: number, dy: number) => castRay(pos.x, pos.y, dx, dy, curGrid, cellTypes);
    const rayUp = ray(0, -1);
    const rayDown = ray(0, 1);
    const rayLeft = ray(-1, 0);
    const rayRight = ray(1, 0);
    const rayDownRight = ray(1, 1);
    const rayUpRight = ray(1, -1);
    const rayDownLeft = ray(-1, 1);
    const rayUpLeft = ray(-1, -1);
    const visitShare = (x: number, y: number) => Math.min((visitCounts[`${x},${y}`] ?? 0) / 5, 1.0);

    return [
        pos.x / cols,
        pos.y / rows,
        battery / maxBat,
        isCharging ? 1 : 0,
        needsDocking ? 1 : 0,

        // Path-based Target Vector (compass)
        targetDirX,
        targetDirY,

        // Enhanced Previous Direction (Inertia)
        prevDir.dx,
        prevDir.dy,
        distToDock,
        distToTarget, // 11

        // Cell values: [Current, Up, Down, Left, Right]
        getCellValue(pos.x, pos.y, curGrid, cellTypes),
        getCellValue(pos.x, pos.y - 1, curGrid, cellTypes),
        getCellValue(pos.x, pos.y + 1, curGrid, cellTypes),
        getCellValue(pos.x - 1, pos.y, curGrid, cellTypes),
        getCellValue(pos.x + 1, pos.y, curGrid, cellTypes), // 15

        // Visit counts: [Current, Up, Down, Left, Right]
        visitShare(pos.x, pos.y),
        visitShare(pos.x, pos.y - 1),
        visitShare(pos.x, pos.y + 1),
        visitShare(pos.x - 1, pos.y),
        visitShare(pos.x + 1, pos.y), // 20

        // Raycasting (8 directions now: 4 straight + 4 diagonal)
        rayUp.grass, rayDown.grass, rayLeft.grass, rayRight.grass,
        rayUp.obstacle, rayDown.obstacle, rayLeft.obstacle, rayRight.obstacle,

        // Diagonals (New)
        rayDownRight.grass, rayUpRight.grass, rayDownLeft.grass, rayUpLeft.grass,
        rayDownRight.obstacle, rayUpRight.obstacle, rayDownLeft.obstacle, rayUpLeft.obstacle,

        // Mowed Rays (8 directions)
        rayUp.mowed, rayDown.mowed, rayLeft.mowed, rayRight.mowed,
        rayDownRight.mowed, rayUpRight.mowed, rayDownLeft.mowed, rayUpLeft.mowed, // 44

        // ORIENTATION
        state.orientation === 'horizontal' ? 1.0 : 0.0, // 45
        state.orientation === 'vertical' ? 1.0 : 0.0    // 46
    ];
};

/** Headings of the four network outputs, in output order: up, down, left, right. */
export const MOVE_HEADINGS: readonly Direction[] = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
];

/** The network only decides next to fresh grass; elsewhere the mower paths to the nearest grass. */
export const hasAdjacentGrass = (pos: Point, curGrid: Grid, cellTypes: typeof CELL_TYPES): boolean =>
    MOVE_HEADINGS.some(({ dx, dy }) => curGrid[pos.y + dy]?.[pos.x + dx]?.type === cellTypes.GRASS);

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

    if (!hasAdjacentGrass(pos, curGrid, cellTypes)) {
        return findPathToTarget(
            pos,
            curGrid,
            prevDir,
            (p) => curGrid[p.y][p.x].type === cellTypes.GRASS,
            turnCostOf(state)
        );
    }

    // Only block the immediate previous cell (anti-ping-pong)
    const prevX = pos.x - prevDir.dx;
    const prevY = pos.y - prevDir.dy;

    // --- NN DECISION ---
    const inputs = prepareNNInputs(state, curGrid, cellTypes);
    const outputs = nn.predict(inputs);

    const allMoves = MOVE_HEADINGS.map(({ dx, dy }, idx) => ({ x: pos.x + dx, y: pos.y + dy, dx, dy, idx }));

    const scoredMoves = allMoves.map(m => {
        let score = outputs[m.idx];

        const targetIsGrass = isGrass(m.x, m.y);

        // Reward grass strongly
        if (targetIsGrass) score += 1.0;

        // Orientation preference ONLY when mowing grass
        const isAligned = orientation === 'horizontal' ? (m.dx !== 0) : (m.dy !== 0);
        if (targetIsGrass && isAligned) score += 0.8;

        // Penalize revisiting mowed cells more strictly to encourage direct paths
        const visits = visitCounts[`${m.x},${m.y}`] ?? 0;
        if (visits > 0) {
            score -= (0.2 + visits * 0.1);
        }

        return { ...m, score };
    }).sort((a, b) => b.score - a.score);

    for (const move of scoredMoves) {
        if (!isValid(move.x, move.y)) continue;

        // Refined anti-ping-pong: avoid going back immediately unless the previous cell is grass
        // and we have no other grass options, or it is the only valid move.
        if (move.x === prevX && move.y === prevY) {
            const hasOtherValidGrass = scoredMoves.some(sm =>
                sm !== move && isGrass(sm.x, sm.y)
            );
            if (hasOtherValidGrass) continue;

            const isPrevCellGrass = isGrass(prevX, prevY);
            if (!isPrevCellGrass) {
                const hasOtherValidMove = scoredMoves.some(sm =>
                    sm !== move && isValid(sm.x, sm.y)
                );
                if (hasOtherValidMove) continue;
            }
        }
        return { x: move.x, y: move.y };
    }

    return null;
};
