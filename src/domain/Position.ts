import type { PositionType } from '../types';

export class Position {
    constructor(
        private readonly _x: number,
        private readonly _y: number
    ) {}

    get x(): number { return this._x; }
    get y(): number { return this._y; }

    equals(other: Position): boolean {
        return this._x === other.x && this._y === other.y;
    }

    toObject(): PositionType {
        return { x: this._x, y: this._y };
    }

    static fromObject(pos: PositionType): Position {
        return new Position(pos.x, pos.y);
    }
}
