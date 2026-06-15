import { describe, it, expect } from 'vitest';
import { mowTile, headingBetween } from './MowingStep';
import { CELL_TYPES, DAMAGE_PER_PASS, DAMAGE_PER_TURN } from '../constants';
import type { Cell } from '../types';

const grass = (over: Partial<Cell> = {}): Cell => ({ type: CELL_TYPES.GRASS, damage: 0, direction: null, ...over });
const mowed = (over: Partial<Cell> = {}): Cell => ({ type: CELL_TYPES.MOWED, damage: 0, direction: null, ...over });
const right = { dx: 1, dy: 0 };

describe('mowTile', () => {
    it('cuts fresh grass on a straight pass: becomes mowed, 1 pass, no damage, keeps heading', () => {
        const result = mowTile(grass(), right, false);

        expect(result.cell.type).toBe(CELL_TYPES.MOWED);
        expect(result.cell.passes).toBe(1);
        expect(result.cell.damage).toBe(0);
        expect(result.cell.direction).toEqual(right);
        expect(result.cutFreshGrass).toBe(true);
        expect(result.overlapped).toBe(false);
    });

    it('cutting fresh grass on a turn adds turn damage', () => {
        const result = mowTile(grass(), right, true);

        expect(result.cell.damage).toBe(DAMAGE_PER_TURN);
        expect(result.cell.passes).toBe(1);
    });

    it('driving over already-mowed grass is an overlap: passes increment and pass damage accrues', () => {
        const result = mowTile(mowed({ passes: 1 }), right, false);

        expect(result.overlapped).toBe(true);
        expect(result.cutFreshGrass).toBe(false);
        expect(result.cell.passes).toBe(2);
        expect(result.cell.damage).toBeCloseTo(DAMAGE_PER_PASS);
        expect(result.cell.type).toBe(CELL_TYPES.MOWED);
    });

    it('accumulates damage and passes across repeated overlaps', () => {
        const once = mowTile(mowed({ passes: 1, damage: 0 }), right, false).cell;
        const twice = mowTile(once, right, false).cell;

        expect(twice.passes).toBe(3);
        expect(twice.damage).toBeCloseTo(DAMAGE_PER_PASS * 2);
    });

    it('leaves the dock untouched and does not count it as a pass', () => {
        const result = mowTile({ type: CELL_TYPES.DOCK, damage: 0, direction: null }, right, false);

        expect(result.cell.type).toBe(CELL_TYPES.DOCK);
        expect(result.cell.passes).toBe(0);
        expect(result.cutFreshGrass).toBe(false);
        expect(result.overlapped).toBe(false);
    });

    it('keeps the previous heading when the mower does not move', () => {
        const result = mowTile(grass({ direction: right }), { dx: 0, dy: 0 }, false);
        expect(result.cell.direction).toEqual(right);
    });
});

describe('headingBetween', () => {
    it('returns the unit step between adjacent tiles', () => {
        expect(headingBetween({ x: 2, y: 2 }, { x: 3, y: 2 })).toEqual({ dx: 1, dy: 0 });
        expect(headingBetween({ x: 2, y: 2 }, { x: 2, y: 1 })).toEqual({ dx: 0, dy: -1 });
    });
});
