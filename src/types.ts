export interface Point {
    x: number;
    y: number;
}

export interface Direction {
    dx: number;
    dy: number;
}

export interface Cell {
    type: string;
    damage?: number;
    direction?: Direction | null;
}

export type Grid = Cell[][];

export interface State {
    pos: Point;
    prevDir: Direction;
    battery: number;
    grid: Grid;
    zigzagIdx?: number;
    uShapeIdx?: number;
    slamDir?: number;
    cellData?: {
        sweepDir: number;
        cellScanDir: number;
    };
    dockPos: Point;
    isCharging: boolean;
    isReturningForCharge: boolean;
    visitCounts: { [key: string]: number };
    orientation?: 'horizontal' | 'vertical';
    maxBattery?: number;
}
