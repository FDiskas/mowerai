import { describe, it, expect } from 'vitest';
import { CELL_TYPES } from '../constants';
import type { Grid } from '../types';
import {
    genericPathSearch, findFullPathToTarget, findPathToTarget,
    getClosestGrass, aStarSearch, bfsSearch,
} from './pathfinding';

/** w×h grid of a single cell type, with optional obstacle coordinates. */
const grid = (w: number, h: number, type = CELL_TYPES.GRASS, obstacles: [number, number][] = []): Grid => {
    const g: Grid = [];
    for (let y = 0; y < h; y++) {
        const row = [];
        for (let x = 0; x < w; x++) row.push({ type, damage: 0, direction: null });
        g.push(row);
    }
    for (const [x, y] of obstacles) g[y][x] = { type: CELL_TYPES.OBSTACLE, damage: 0, direction: null };
    return g;
};
const at = (x: number, y: number) => (p: { x: number; y: number }) => p.x === x && p.y === y;
const manhattan = (ax: number, ay: number, bx: number, by: number) => Math.abs(ax - bx) + Math.abs(ay - by);

describe('genericPathSearch', () => {
    it('finds a shortest path on an open grid (length = manhattan distance)', () => {
        const g = grid(8, 6);
        const path = findFullPathToTarget({ x: 0, y: 0 }, g, { dx: 0, dy: 1 }, at(5, 3));
        expect(path).not.toBeNull();
        expect(path!.length).toBe(manhattan(0, 0, 5, 3));
        expect(path![path!.length - 1]).toEqual({ x: 5, y: 3 });
    });

    it('excludes the start and returns each step adjacent to the last', () => {
        const g = grid(8, 6);
        const path = findFullPathToTarget({ x: 1, y: 1 }, g, { dx: 0, dy: 1 }, at(4, 1))!;
        expect(path).not.toContainEqual({ x: 1, y: 1 });
        let prev = { x: 1, y: 1 };
        for (const step of path) {
            expect(manhattan(prev.x, prev.y, step.x, step.y)).toBe(1);
            prev = step;
        }
    });

    it('routes around obstacles and never steps on one', () => {
        // Vertical wall at x=3 spanning y=0..4, with a gap at y=5.
        const obstacles: [number, number][] = [[3, 0], [3, 1], [3, 2], [3, 3], [3, 4]];
        const g = grid(7, 6, CELL_TYPES.GRASS, obstacles);
        const path = findFullPathToTarget({ x: 0, y: 0 }, g, { dx: 0, dy: 1 }, at(6, 0))!;
        expect(path).not.toBeNull();
        expect(path[path.length - 1]).toEqual({ x: 6, y: 0 });
        for (const step of path) expect(g[step.y][step.x].type).not.toBe(CELL_TYPES.OBSTACLE);
    });

    it('returns null when the target is fully enclosed', () => {
        const g = grid(6, 6, CELL_TYPES.GRASS, [[2, 1], [0, 1], [1, 0], [1, 2]]);
        // (1,1) is surrounded by obstacles on all four sides.
        const path = findFullPathToTarget({ x: 4, y: 4 }, g, { dx: 0, dy: 1 }, at(1, 1));
        expect(path).toBeNull();
    });

    it('respects the turn penalty: a straight shot keeps the initial heading', () => {
        const g = grid(8, 3);
        // Start heading right; target straight ahead -> zero turns, no detours.
        const path = findFullPathToTarget({ x: 0, y: 1 }, g, { dx: 1, dy: 0 }, at(5, 1))!;
        expect(path.map(p => p.y)).toEqual([1, 1, 1, 1, 1]);
    });

    it('findPathToTarget returns just the first step of the full path', () => {
        const g = grid(8, 6);
        const full = findFullPathToTarget({ x: 0, y: 0 }, g, { dx: 0, dy: 1 }, at(5, 3))!;
        expect(findPathToTarget({ x: 0, y: 0 }, g, { dx: 0, dy: 1 }, at(5, 3))).toEqual(full[0]);
    });

    it('does not match the start cell itself as the target', () => {
        const g = grid(5, 5);
        // Only the start matches; a real different target does not exist -> null.
        const path = genericPathSearch({ x: 2, y: 2 }, g, { dx: 0, dy: 1 }, at(2, 2));
        expect(path).toBeNull();
    });
});

describe('getClosestGrass', () => {
    it('returns the nearest grass cell by manhattan distance', () => {
        const g = grid(5, 5, CELL_TYPES.MOWED);
        g[0][4] = { type: CELL_TYPES.GRASS, damage: 0, direction: null };
        g[3][3] = { type: CELL_TYPES.GRASS, damage: 0, direction: null };
        expect(getClosestGrass({ x: 4, y: 4 }, g, CELL_TYPES)).toEqual({ x: 3, y: 3 });
    });

    it('returns null when there is no grass left', () => {
        expect(getClosestGrass({ x: 0, y: 0 }, grid(4, 4, CELL_TYPES.MOWED), CELL_TYPES)).toBeNull();
    });
});

describe('search wrappers', () => {
    it('aStarSearch returns a valid first step toward the target', () => {
        const g = grid(8, 6);
        const step = aStarSearch({ x: 0, y: 0 }, { x: 5, y: 0 }, g, { dx: 1, dy: 0 })!;
        expect(step).toEqual({ x: 1, y: 0 });
    });

    it('bfsSearch finds grass via a predicate', () => {
        const g = grid(6, 6, CELL_TYPES.MOWED);
        g[0][3] = { type: CELL_TYPES.GRASS, damage: 0, direction: null };
        const step = bfsSearch({ x: 0, y: 0 }, p => g[p.y][p.x].type === CELL_TYPES.GRASS, g)!;
        expect(manhattan(0, 0, step.x, step.y)).toBe(1);
    });
});
