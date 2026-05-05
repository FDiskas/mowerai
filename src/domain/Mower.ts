import { Battery } from './Battery';
import { NavigationState } from './NavigationState';
import { Position } from './Position';

export class Mower {
    constructor(
        private readonly _battery: Battery,
        private readonly _nav: NavigationState
    ) {}

    get battery(): Battery { return this._battery; }
    get nav(): NavigationState { return this._nav; }
    get pos(): Position { return this._nav.pos; }

    move(newPos: Position, cost: number): Mower {
        return new Mower(
            this._battery.drain(cost),
            this._nav.moveTo(newPos)
        );
    }

    charge(amount: number): Mower {
        return new Mower(
            this._battery.charge(amount),
            this._nav
        );
    }
}
