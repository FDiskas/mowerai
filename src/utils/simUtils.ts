import { CELL_TYPES } from '../constants';

export const countGrass = (currentGrid) => {
    if (!currentGrid || currentGrid.length === 0) return 0;
    return currentGrid.flat().filter(cell => cell.type === CELL_TYPES.GRASS).length;
};
