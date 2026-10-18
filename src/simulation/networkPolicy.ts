import { CELL_TYPES } from '../constants';
import type { Direction, Point, State } from '../types';
import type { MovePolicy } from './episode';
import { isSeen, type KnownMap } from './knownMap';
import { PolicyNetwork, type NetworkData } from './policyNetwork';

/**
 * Everything the network sees comes from the mower's known map, turned so that
 * the mower always faces "up". It gets no route and no chosen move.
 *
 * - Local window: 9×9 tiles around the mower, 4 channels each
 *   (blocked = obstacle or outside, unseen, grass, cut grass).
 * - Coarse map: 7×7 blocks of 5×5 tiles around the mower, 3 shares each
 *   (grass, unseen, blocked), so the network can find work further away.
 * - Battery share and the dock offset (ahead, right).
 * - Distance field, per move (ahead, right, back, left): nearness of the
 *   closest uncut grass, 1 / (1 + steps), and whether the move gets closer
 *   to it (−1 closer, 0 same, +1 further). The user allowed this input on
 *   2026-10-18: without it the network could not find far grass.
 */
const WINDOW_RADIUS = 4;
const WINDOW_SIZE = 2 * WINDOW_RADIUS + 1;
const WINDOW_CHANNELS = 4;
const BLOCK_RADIUS = 3;
const BLOCKS = 2 * BLOCK_RADIUS + 1;
const BLOCK_SIZE = 5;
const BLOCK_CHANNELS = 3;
const SCALARS = 3;
const DISTANCE_INPUTS = 2 * 4;

const WINDOW_INPUTS = WINDOW_CHANNELS * WINDOW_SIZE * WINDOW_SIZE;
const BLOCK_INPUTS = BLOCK_CHANNELS * BLOCKS * BLOCKS;

export const OBSERVATION_SIZE = WINDOW_INPUTS + BLOCK_INPUTS + SCALARS + DISTANCE_INPUTS;
/** Outputs, relative to the heading: ahead, right, back, left. */
export const ACTION_COUNT = 4;
export const NETWORK_LAYERS = [OBSERVATION_SIZE, 32, 32, ACTION_COUNT];

/** Tile kinds; every kind except `Free` has its own window channel (kind − 1). */
const Tile = { Free: 0, Blocked: 1, Unseen: 2, Grass: 3, Mowed: 4 } as const;
type TileKind = typeof Tile[keyof typeof Tile];

const tileAt = (known: KnownMap, x: number, y: number): TileKind => {
    const rows = known.grid.length;
    if (x < 0 || y < 0 || x >= known.cols || y >= rows) return Tile.Blocked;
    if (!isSeen(known, x, y)) return Tile.Unseen;
    const type = known.grid[y][x].type;
    if (type === CELL_TYPES.OBSTACLE) return Tile.Blocked;
    if (type === CELL_TYPES.GRASS) return Tile.Grass;
    if (type === CELL_TYPES.MOWED) return Tile.Mowed;
    return Tile.Free;
};

/** The start heading (0, 0) is treated as facing down, like the first move of every run. */
const facing = (prevDir: Direction): Direction =>
    prevDir.dx === 0 && prevDir.dy === 0 ? { dx: 0, dy: 1 } : prevDir;

const rightOf = (heading: Direction): Direction => ({ dx: -heading.dy, dy: heading.dx });

/** Writes the observation of `state` into `out` (length `OBSERVATION_SIZE`). */
export const observe = (state: State, known: KnownMap, out: Float32Array): Float32Array => {
    out.fill(0);
    const { pos, dockPos, battery } = state;
    const ahead = facing(state.prevDir);
    const right = rightOf(ahead);
    const worldX = (forward: number, side: number) => pos.x + forward * ahead.dx + side * right.dx;
    const worldY = (forward: number, side: number) => pos.y + forward * ahead.dy + side * right.dy;

    const cellsPerChannel = WINDOW_SIZE * WINDOW_SIZE;
    for (let row = 0; row < WINDOW_SIZE; row++) {
        const forward = WINDOW_RADIUS - row;
        for (let col = 0; col < WINDOW_SIZE; col++) {
            const side = col - WINDOW_RADIUS;
            const tile = tileAt(known, worldX(forward, side), worldY(forward, side));
            if (tile !== Tile.Free) out[(tile - 1) * cellsPerChannel + row * WINDOW_SIZE + col] = 1;
        }
    }

    const blocksPerChannel = BLOCKS * BLOCKS;
    const share = 1 / (BLOCK_SIZE * BLOCK_SIZE);
    const half = Math.floor(BLOCK_SIZE / 2);
    for (let row = 0; row < BLOCKS; row++) {
        const blockForward = (BLOCK_RADIUS - row) * BLOCK_SIZE;
        for (let col = 0; col < BLOCKS; col++) {
            const blockSide = (col - BLOCK_RADIUS) * BLOCK_SIZE;
            const cell = row * BLOCKS + col;
            for (let f = -half; f <= half; f++) {
                for (let s = -half; s <= half; s++) {
                    const tile = tileAt(known, worldX(blockForward + f, blockSide + s), worldY(blockForward + f, blockSide + s));
                    if (tile === Tile.Grass) out[WINDOW_INPUTS + cell] += share;
                    else if (tile === Tile.Unseen) out[WINDOW_INPUTS + blocksPerChannel + cell] += share;
                    else if (tile === Tile.Blocked) out[WINDOW_INPUTS + 2 * blocksPerChannel + cell] += share;
                }
            }
        }
    }

    const scale = 1 / (known.grid.length + known.cols);
    const toDockX = dockPos.x - pos.x;
    const toDockY = dockPos.y - pos.y;
    const scalars = WINDOW_INPUTS + BLOCK_INPUTS;
    out[scalars] = battery / (state.maxBattery ?? 100);
    out[scalars + 1] = (toDockX * ahead.dx + toDockY * ahead.dy) * scale;
    out[scalars + 2] = (toDockX * right.dx + toDockY * right.dy) * scale;

    const distances = distanceToGrass(known, pos);
    const here = distances[pos.y * known.cols + pos.x];
    const distance = scalars + SCALARS;
    actionDirections(state.prevDir).forEach((d, action) => {
        const x = pos.x + d.dx;
        const y = pos.y + d.dy;
        const steps = x >= 0 && y >= 0 && x < known.cols && y < known.grid.length ? distances[y * known.cols + x] : -1;
        out[distance + action] = steps < 0 ? 0 : 1 / (1 + steps);
        out[distance + 4 + action] = steps < 0 || here < 0 ? 1 : Math.sign(steps - here);
    });
    return out;
};

/**
 * Steps from every tile to the closest grass on the known map, around known
 * obstacles (−1: no grass reachable). The mower's own tile does not count: it
 * is cut when the mower leaves it.
 */
const distanceToGrass = (known: KnownMap, pos: Point): Int32Array => {
    const { grid, cols } = known;
    const distances = new Int32Array(grid.length * cols).fill(-1);
    const queue: number[] = [];
    grid.forEach((row, y) => row.forEach((cell, x) => {
        if (cell.type !== CELL_TYPES.GRASS || (x === pos.x && y === pos.y)) return;
        distances[y * cols + x] = 0;
        queue.push(y * cols + x);
    }));
    for (let head = 0; head < queue.length; head++) {
        const index = queue[head];
        const x = index % cols;
        const y = (index - x) / cols;
        for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
            if (nx < 0 || ny < 0 || nx >= cols || ny >= grid.length) continue;
            const next = ny * cols + nx;
            if (distances[next] >= 0 || grid[ny][nx].type === CELL_TYPES.OBSTACLE) continue;
            distances[next] = distances[index] + 1;
            queue.push(next);
        }
    }
    return distances;
};

/** World direction of each output: ahead, right, back, left. */
const actionDirections = (prevDir: Direction): Direction[] => {
    const ahead = facing(prevDir);
    const right = rightOf(ahead);
    return [ahead, right, { dx: -ahead.dx, dy: -ahead.dy }, { dx: -right.dx, dy: -right.dy }];
};

/** Output index (ahead, right, back, left) of a move to a neighbouring tile. */
export const actionOfMove = (state: State, move: Point): number =>
    actionDirections(state.prevDir).findIndex(d => d.dx === move.x - state.pos.x && d.dy === move.y - state.pos.y);

/**
 * The network as a policy: the move with the highest output among the legal ones.
 * Only moves into a known obstacle or off the lawn are masked; nothing else is overridden.
 */
export const networkPolicy = (data: NetworkData): MovePolicy => {
    const network = new PolicyNetwork(data);
    const input = new Float32Array(OBSERVATION_SIZE);
    return (state, known) => {
        const outputs = network.forward(observe(state, known, input));
        let best: Point | null = null;
        let bestValue = -Infinity;
        actionDirections(state.prevDir).forEach((d, action) => {
            const x = state.pos.x + d.dx;
            const y = state.pos.y + d.dy;
            const tile = known.grid[y]?.[x];
            if (!tile || tile.type === CELL_TYPES.OBSTACLE) return;
            if (outputs[action] > bestValue) {
                bestValue = outputs[action];
                best = { x, y };
            }
        });
        return best;
    };
};
