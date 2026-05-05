import { Mower } from './Mower';
import { SimulationGrid } from './SimulationGrid';
import { Position } from './Position';

export class SimulationEnvironment {
    constructor(
        private readonly _mower: Mower,
        private readonly _grid: SimulationGrid,
        private readonly _dockPos: Position
    ) {}

    get mower(): Mower { return this._mower; }
    get grid(): SimulationGrid { return this._grid; }
    get dockPos(): Position { return this._dockPos; }

    withMower(mower: Mower): SimulationEnvironment {
        return new SimulationEnvironment(mower, this._grid, this._dockPos);
    }

    withGrid(grid: SimulationGrid): SimulationEnvironment {
        return new SimulationEnvironment(this._mower, grid, this._dockPos);
    }
}
