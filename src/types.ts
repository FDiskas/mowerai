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
    };
    dockPos: PositionType;
    isCharging: boolean;
    isReturningForCharge: boolean;
    visitCounts: { [key: string]: number };
    orientation?: 'horizontal' | 'vertical';
    maxBattery?: number;
}

export interface FitnessConfig {
    // Apdovanojimai (teigiami = gerai)
    discoveryReward: number;       // Premija už naują langelį (default: 500)
    orientationBonus: number;      // Premija už teisingą kryptį (default: 100)
    completionBonus: number;       // Premija už visų plotų nupjovimą ir grįžimą (default: 10000)
    straightLineBonus: number;     // Premija už tiesią liniją (default: 500)
    batteryEfficiencyWeight: number; // Baterijos efektyvumo premijos svoris (default: 30000)

    // Baudos (neigiamos reikšmės suprantamos kaip bauda)
    mowedRevisitPenalty: number;   // Bauda už nupjautos žolės perriedėjimą (default: 50)
    oscillationPenalty: number;    // Bauda už ciklinį judėjimą (default: 5000)
    turnPenalty: number;           // Bauda už posūkį (default: 100)
    batteryOutPenalty: number;     // Bauda už baterijos išsikrovimą ne doke (default: 2000)
    damageWeight: number;          // Žolės pažeidimo baudos svoris (default: 10000)
    chargeCycleWeight: number;     // Įkrovimo ciklų baudos svoris (default: 20000)

    // Kietieji limitai
    visitLimit: number;            // Vizitų limitas prieš diskvalifikaciją (default: 5)
    maxMowedRevisitRatio: number;  // Max nupjautos žolės perriedėjimų dalis (default: 0.25)
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
