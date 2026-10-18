import { CELL_TYPES } from './constants';

export type CellType = typeof CELL_TYPES[keyof typeof CELL_TYPES];

export interface Direction {
    dx: number;
    dy: number;
}

export interface Cell {
    type: CellType;
    damage: number;
    direction: Direction | null;
    /** How many times the mower has driven over this tile (>=2 means overlap). */
    passes?: number;
}

export type Grid = Cell[][];

export interface PositionType {
    x: number;
    y: number;
}

export type Point = PositionType;

export type Orientation = 'horizontal' | 'vertical';

export interface Stats {
    distance: number;
    mowedCount: number;
    totalGrass: number;
    turns: number;
    chargeCycles: number;
    history: HistoryRecord[];
}

export interface HistoryRecord {
    id: number;
    algo: string;
    distance: number;
    turns: number;
    mowedCount: number;
    /** Share of the lawn this run mowed, in percent with one decimal. */
    coverage: number;
    duration: number;
    damagedGrass: number;
    chargeCycles: number;
    /** Benchmark cost per reachable tile (`costPerTile`); null for runs saved before the fixed score. */
    cost: number | null;
}

export interface State {
    pos: PositionType;
    prevDir: Direction;
    battery: number;
    grid: Grid;
    cellData?: {
        sweepDir: number;
        cellScanDir: number;
        /** Mowing direction chosen by direction-optimization (longest-edge). */
        orientation?: Orientation;
        /** State machine phase: contour pass first, then parallel sweep. */
        phase?: 'edge' | 'zigzag';
    };
    spiralCenter?: PositionType;
    /** Grass tile the mower drives to; kept until it is cut (see `committedGoal`). */
    goal?: PositionType;
    activeCellId?: number;
    cellIdGrid?: number[][];
    /** `mapVersion` that `cellIdGrid` was built from. */
    cellIdGridVersion?: number;
    dockPos: PositionType;
    orientation?: Orientation;
    maxBattery?: number;
    /** Price of one heading change in path steps; unset means the default. */
    turnCost?: number;
    /** Goes up each time the sensor finds an obstacle: maps derived from `grid` before that are stale. */
    mapVersion?: number;
}
