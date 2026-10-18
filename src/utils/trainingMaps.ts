import { CELL_TYPES } from '../constants';
import type { Grid, Point } from '../types';

const ROOM_WIDTH = 6;
const DOORS_PER_WALL = 2;

const randomInt = (max: number) => Math.floor(Math.random() * max);

const emptyLawn = (width: number, height: number, dock: Point): Grid =>
    Array.from({ length: height }, (_, y) =>
        Array.from({ length: width }, (_, x) => ({
            type: x === dock.x && y === dock.y ? CELL_TYPES.DOCK : CELL_TYPES.GRASS,
            damage: 0,
            direction: null,
        })));

const withObstacles = (lawn: Grid, tiles: Point[], dock: Point): Grid => {
    const grid = lawn.map(row => row.map(cell => ({ ...cell })));
    for (const { x, y } of tiles) {
        if (grid[y]?.[x] && (x !== dock.x || y !== dock.y)) grid[y][x].type = CELL_TYPES.OBSTACLE;
    }
    return grid;
};

const scatteredTiles = (count: number, width: number, height: number): Point[] =>
    Array.from({ length: count }, () => ({ x: randomInt(width), y: randomInt(height) }));

/** Vertical walls every `ROOM_WIDTH` columns, each with doors, so every room stays reachable. */
const roomWallTiles = (width: number, height: number, dock: Point): Point[] => {
    const tiles: Point[] = [];
    for (let x = ROOM_WIDTH - 1; x < width - 1; x += ROOM_WIDTH) {
        if (x === dock.x) continue;
        const doors = new Set(Array.from({ length: DOORS_PER_WALL }, () => randomInt(height)));
        for (let y = 0; y < height; y++) {
            if (!doors.has(y)) tiles.push({ x, y });
        }
    }
    return tiles;
};

const corridorTiles = (width: number, height: number): Point[] => {
    const rows = [Math.floor(height * 0.35), Math.floor(height * 0.6)];
    return rows.flatMap(y => Array.from({ length: Math.max(0, width - 10) }, (_, i) => ({ x: i + 5, y })));
};

/** Lawn layouts the network trains on: open, scattered, rooms, corridors and cluttered. */
export const generateTrainingMaps = (width: number, height: number, dock: Point): Grid[] => {
    const empty = emptyLawn(width, height, dock);
    return [
        empty,
        withObstacles(empty, scatteredTiles(30, width, height), dock),
        withObstacles(empty, roomWallTiles(width, height, dock), dock),
        withObstacles(empty, corridorTiles(width, height), dock),
        withObstacles(empty, scatteredTiles(60, width, height), dock),
    ];
};
