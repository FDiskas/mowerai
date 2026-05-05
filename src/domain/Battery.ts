export class Battery {
    constructor(
        private readonly _current: number,
        private readonly _max: number
    ) {}

    get current(): number { return this._current; }
    get max(): number { return this._max; }
    get percentage(): number { return (this._current / this._max) * 100; }
    get isLow(): boolean { return this.percentage < 20; }
    get isEmpty(): boolean { return this._current <= 0; }

    drain(amount: number): Battery {
        return new Battery(Math.max(0, this._current - amount), this._max);
    }

    charge(amount: number): Battery {
        return new Battery(Math.min(this._max, this._current + amount), this._max);
    }

    isHalfCharged(): boolean {
        return this.percentage >= 50;
    }
}
