import { CELL_TYPES } from '../constants';
import type { Grid } from '../types';

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
