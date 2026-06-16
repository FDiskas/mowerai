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

export interface Stats {
    distance: number;
    mowedCount: number;
    totalGrass: number;
    turns: number;
    chargeCycles: number;
    startTime: number | null;
    endTime: number | null;
    accumulatedDuration: number;
    history: HistoryRecord[];
}

export interface HistoryRecord {
    id: number;
    algo: string;
    distance: number;
    turns: number;
    mowedCount: number;
    duration: number;
    damagedGrass: number;
    chargeCycles: number;
    penalty: number;
    moves?: PositionType[];
}

export interface TrainingStatus {
    isTraining: boolean;
    epoch: number;
    bestFitness: number;
}

export interface State {
    pos: PositionType;
    prevDir: Direction;
    battery: number;
    grid: Grid;
    zigzagIdx?: number;
    uShapeIdx?: number;
    slamDir?: number;
    cellData?: {
        sweepDir: number;
        cellScanDir: number;
        /** Mowing direction chosen by direction-optimization (longest-edge). */
        orientation?: 'horizontal' | 'vertical';
        /** State machine phase: contour pass first, then parallel sweep. */
        phase?: 'edge' | 'zigzag';
    };
    spiralStep?: number;
    spiralCenter?: PositionType;
    stcPath?: PositionType[];
    activeCellId?: number;
    cellIdGrid?: number[][];
    dockPos: PositionType;
    isCharging: boolean;
    isReturningForCharge: boolean;
    visitCounts: { [key: string]: number };
    orientation?: 'horizontal' | 'vertical';
    maxBattery?: number;
}

export interface FitnessConfig {
    // Rewards (positive = good)
    discoveryReward: number;       // Bonus for a new cell (default: 500)
    orientationBonus: number;      // Bonus for the correct direction (default: 100)
    completionBonus: number;       // Bonus for mowing all areas and returning (default: 10000)
    straightLineBonus: number;     // Bonus for a straight line (default: 500)
    batteryEfficiencyWeight: number; // Weight for battery efficiency bonus (default: 30000)

    // Penalties (negative values are understood as penalties)
    mowedRevisitPenalty: number;   // Penalty for overrunning mowed grass (default: 50)
    oscillationPenalty: number;    // Penalty for cyclic movement (default: 5000)
    turnPenalty: number;           // Penalty for a turn (default: 100)
    batteryOutPenalty: number;     // Penalty for battery running out outside the dock (default: 2000)
    damageWeight: number;          // Weight for grass damage penalty (default: 10000)
    chargeCycleWeight: number;     // Weight for charging cycle penalty (default: 20000)

    // Hard Limits
    visitLimit: number;            // Visit limit before disqualification (default: 5)
    maxMowedRevisitRatio: number;  // Max ratio of mowed grass overruns (default: 0.25)
}

export const DEFAULT_FITNESS_CONFIG: FitnessConfig = {
    discoveryReward: 500,
    orientationBonus: 100,
    completionBonus: 10000,
    straightLineBonus: 500,
    batteryEfficiencyWeight: 30000,
    mowedRevisitPenalty: 50,
    oscillationPenalty: 5000,
    turnPenalty: 100,
    batteryOutPenalty: 2000,
    damageWeight: 10000,
    chargeCycleWeight: 20000,
    visitLimit: 5,
    maxMowedRevisitRatio: 0.25,
};
