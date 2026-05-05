import { Position } from './Position';
import type { Direction } from '../types';

export class NavigationState {
    constructor(
        private readonly _pos: Position,
        private readonly _dir: Direction
    ) {}

    get pos(): Position { return this._pos; }
    get dir(): Direction { return this._dir; }

    moveTo(newPos: Position): NavigationState {
        const dx = newPos.x - this._pos.x;
        const dy = newPos.y - this._pos.y;
        return new NavigationState(newPos, { dx, dy });
    }

    isTurning(nextPos: Position): boolean {
        const dx = nextPos.x - this._pos.x;
        const dy = nextPos.y - this._pos.y;
        return dx !== this._dir.dx || dy !== this._dir.dy;
    }
}
