import { CELL_TYPES } from '../constants';
import type { Grid, Point } from '../types';
import { createRandom, randomInt, type Random } from './random';

/** A lawn as it really is, with the dock the mower starts from. */
export interface Lawn {
    grid: Grid;
    dock: Point;
}

export const LAYOUTS = ['open', 'trees', 'beds', 'hedges', 'irregular', 'mixed'] as const;
export type Layout = typeof LAYOUTS[number];

interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

const MIN_WIDTH = 14;
const MAX_WIDTH = 30;
const MIN_HEIGHT = 10;
const MAX_HEIGHT = 22;

const isInLandingZone = (x: number, y: number, dock: Point) =>
    Math.abs(x - dock.x) <= 1 && Math.abs(y - dock.y) <= 1;

/** Docks stand at the edge of a lawn, like a real charging station against a wall or fence. */
const edgeDock = (random: Random, width: number, height: number): Point => {
    const side = randomInt(random, 0, 3);
    if (side === 0) return { x: randomInt(random, 0, width - 1), y: 0 };
    if (side === 1) return { x: randomInt(random, 0, width - 1), y: height - 1 };
    if (side === 2) return { x: 0, y: randomInt(random, 0, height - 1) };
    return { x: width - 1, y: randomInt(random, 0, height - 1) };
};

const randomRect = (random: Random, width: number, height: number, maxW: number, maxH: number): Rect => {
    const w = randomInt(random, 2, maxW);
    const h = randomInt(random, 2, maxH);
    return { x: randomInt(random, 0, width - w), y: randomInt(random, 0, height - h), width: w, height: h };
};

const rectTiles = ({ x, y, width, height }: Rect): Point[] =>
    Array.from({ length: width * height }, (_, i) => ({ x: x + (i % width), y: y + Math.floor(i / width) }));

const treeTiles = (random: Random, width: number, height: number): Point[] => {
    const count = Math.round(width * height * (0.02 + random() * 0.05));
    return Array.from({ length: count }, () => {
        const x = randomInt(random, 0, width - 1);
        const y = randomInt(random, 0, height - 1);
        // A third of the trees are 2x2 clumps.
        return random() < 0.33 ? rectTiles({ x, y, width: 2, height: 2 }) : [{ x, y }];
    }).flat();
};

const bedTiles = (random: Random, width: number, height: number): Point[] =>
    Array.from({ length: randomInt(random, 2, 5) }, () => rectTiles(randomRect(random, width, height, 6, 4))).flat();

/** Hedge lines across the lawn, each with one or two gaps the mower can pass. */
const hedgeTiles = (random: Random, width: number, height: number): Point[] => {
    const isVertical = random() < 0.5;
    const span = isVertical ? width : height;
    const length = isVertical ? height : width;
    const hedgeCount = randomInt(random, 1, Math.max(1, Math.floor(span / 7)));
    const tiles: Point[] = [];
    for (let i = 1; i <= hedgeCount; i++) {
        const at = Math.floor((span * i) / (hedgeCount + 1));
        const gaps = Array.from({ length: randomInt(random, 1, 2) }, () => randomInt(random, 0, length - 2));
        for (let along = 0; along < length; along++) {
            if (gaps.some(gap => along === gap || along === gap + 1)) continue;
            tiles.push(isVertical ? { x: at, y: along } : { x: along, y: at });
        }
    }
    return tiles;
};

/** Corners and edge notches cut away (a house, a patio), so the lawn is not a rectangle. */
const irregularBorderTiles = (random: Random, width: number, height: number): Point[] =>
    Array.from({ length: randomInt(random, 1, 3) }, () => {
        const w = randomInt(random, 3, Math.floor(width / 2));
        const h = randomInt(random, 2, Math.floor(height / 2));
        const x = random() < 0.5 ? 0 : width - w;
        const y = random() < 0.5 ? 0 : height - h;
        return rectTiles({ x, y, width: w, height: h });
    }).flat();

const obstacleTiles = (layout: Layout, random: Random, width: number, height: number): Point[] => {
    switch (layout) {
        case 'open': return [];
        case 'trees': return treeTiles(random, width, height);
        case 'beds': return bedTiles(random, width, height);
        case 'hedges': return hedgeTiles(random, width, height);
        case 'irregular': return irregularBorderTiles(random, width, height);
        case 'mixed': return [
            ...irregularBorderTiles(random, width, height),
            ...bedTiles(random, width, height),
            ...treeTiles(random, width, height),
        ];
    }
};

/**
 * A lawn drawn from `seed`: the same seed always gives the same lawn, so the
 * training, validation and test sets can be kept apart by seed range.
 */
export const generateLawn = (seed: number): Lawn => {
    const random = createRandom(seed);
    const layout = LAYOUTS[randomInt(random, 0, LAYOUTS.length - 1)];
    const width = randomInt(random, MIN_WIDTH, MAX_WIDTH);
    const height = randomInt(random, MIN_HEIGHT, MAX_HEIGHT);
    const dock = edgeDock(random, width, height);

    const grid: Grid = Array.from({ length: height }, (_, y) =>
        Array.from({ length: width }, (_, x) => ({
            type: x === dock.x && y === dock.y ? CELL_TYPES.DOCK : CELL_TYPES.GRASS,
            damage: 0,
            direction: null,
        })));

    for (const { x, y } of obstacleTiles(layout, random, width, height)) {
        if (x < 0 || y < 0 || x >= width || y >= height || isInLandingZone(x, y, dock)) continue;
        grid[y][x].type = CELL_TYPES.OBSTACLE;
    }
    return { grid, dock };
};

/** Seed ranges that never overlap, so the network is never tested on a lawn it trained on. */
export const SEED_RANGES = {
    training: 1,
    validation: 1_000_000,
    test: 2_000_000,
} as const;

export const lawnSet = (set: keyof typeof SEED_RANGES, count: number, offset = 0): Lawn[] =>
    Array.from({ length: count }, (_, i) => generateLawn(SEED_RANGES[set] + offset + i));
