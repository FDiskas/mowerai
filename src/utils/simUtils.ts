import { CELL_TYPES } from '../constants';
import type { Grid, Cell } from '../types';

export const countGrass = (currentGrid: Grid) => {
    if (!currentGrid || currentGrid.length === 0) return 0;
    return currentGrid.flat().filter((cell: Cell) => cell.type === CELL_TYPES.GRASS).length;
};

/**
 * Regrow a lawn for a fresh run: mowed tiles become grass again and all
 * cut history (damage, heading, overlap passes) is cleared.
 */
export const resetLawn = (grid: Grid): Grid =>
    grid.map(row => row.map(cell => ({
        ...cell,
        type: cell.type === CELL_TYPES.MOWED ? CELL_TYPES.GRASS : cell.type,
        damage: 0,
        direction: null,
        passes: 0,
    })));
