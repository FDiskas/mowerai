import { CELL_TYPES, DAMAGE_PER_PASS, DAMAGE_PER_TURN } from '../constants';
import type { Cell, Direction } from '../types';

export interface MowOutcome {
    /** The tile after the mower has driven over it. */
    cell: Cell;
    /** The tile held fresh grass that was cut on this pass. */
    cutFreshGrass: boolean;
    /** The mower drove over a tile that was already mowed (overlap). */
    overlapped: boolean;
}

const isLawn = (type: Cell['type']) =>
    type === CELL_TYPES.GRASS || type === CELL_TYPES.MOWED;

/**
 * Pure transformation of a single tile when the mower passes over it.
 *
 * This is the single source of truth for cut state, heading, wear and overlap
 * counting. The live simulation and the neural-network preview both delegate
 * here so the map renders identically for either one.
 */
export const mowTile = (cell: Cell, moveDir: Direction, isTurn: boolean): MowOutcome => {
    const cutFreshGrass = cell.type === CELL_TYPES.GRASS;
    const overlapped = cell.type === CELL_TYPES.MOWED;

    const damageDelta = isTurn ? DAMAGE_PER_TURN : (cutFreshGrass ? 0 : DAMAGE_PER_PASS);
    const heading = (moveDir.dx !== 0 || moveDir.dy !== 0) ? moveDir : cell.direction;

    return {
        cell: {
            ...cell,
            type: cutFreshGrass ? CELL_TYPES.MOWED : cell.type,
            direction: heading,
            damage: (cell.damage || 0) + damageDelta,
            passes: (cell.passes || 0) + (isLawn(cell.type) ? 1 : 0),
        },
        cutFreshGrass,
        overlapped,
    };
};

/** Direction vector from one tile to the next (zero vector if unchanged). */
export const headingBetween = (
    from: { x: number; y: number },
    to: { x: number; y: number }
): Direction => ({ dx: to.x - from.x, dy: to.y - from.y });
