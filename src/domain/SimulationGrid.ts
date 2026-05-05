import { type Grid as GridType, type Cell, type PositionType } from '../types';
import { CELL_TYPES } from '../constants';

export class SimulationGrid {
    constructor(
        private readonly _cells: GridType
    ) { }

    get cells(): GridType { return this._cells; }

    getCell(pos: PositionType): Cell {
        return this._cells[pos.y][pos.x];
    }

    updateCell(pos: PositionType, update: Partial<Cell>): SimulationGrid {
        const newCells = this._cells.map((row, r) =>
            row.map((cell, c) =>
                (r === pos.y && c === pos.x) ? { ...cell, ...update } : cell
            )
        );
        return new SimulationGrid(newCells);
    }

    isGrass(pos: PositionType): boolean {
        return this.getCell(pos).type === CELL_TYPES.GRASS;
    }

    isObstacle(pos: PositionType): boolean {
        return this.getCell(pos).type === CELL_TYPES.OBSTACLE;
    }

    countGrass(): number {
        return this._cells.flat().filter(c => c.type === CELL_TYPES.GRASS).length;
    }
}
