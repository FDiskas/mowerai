import { CELL_TYPES } from '../constants';
import type { Grid, Cell } from '../types';

export const countGrass = (currentGrid: Grid) => {
    if (!currentGrid || currentGrid.length === 0) return 0;
    return currentGrid.flat().filter((cell: Cell) => cell.type === CELL_TYPES.GRASS).length;
};
