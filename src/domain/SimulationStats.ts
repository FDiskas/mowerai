import type { SimulationGrid } from './SimulationGrid';

export class MovementMetrics {
    constructor(
        public readonly distance: number,
        public readonly turns: number
    ) {}

    addMove(): MovementMetrics {
        return new MovementMetrics(this.distance + 1, this.turns);
    }

    addTurn(): MovementMetrics {
        return new MovementMetrics(this.distance, this.turns + 1);
    }
}

export class EfficiencyMetrics {
    constructor(
        public readonly mowedCount: number,
        public readonly totalGrass: number
    ) {}

    /** Counts taken from the lawn itself, so they stay true after the map is edited. */
    static fromGrid(grid: SimulationGrid): EfficiencyMetrics {
        const mowed = grid.countMowed();
        return new EfficiencyMetrics(mowed, mowed + grid.countGrass());
    }

    get coveragePercentage(): number {
        if (this.totalGrass === 0) return 0;
        return (this.mowedCount / this.totalGrass) * 100;
    }

    addMow(): EfficiencyMetrics {
        return new EfficiencyMetrics(this.mowedCount + 1, this.totalGrass);
    }
}

export class ImpactMetrics {
    constructor(
        public readonly chargeCycles: number
    ) {}

    addChargeCycle(): ImpactMetrics {
        return new ImpactMetrics(this.chargeCycles + 1);
    }
}

export class SimulationStats {
    constructor(
        public readonly movement: MovementMetrics,
        public readonly efficiency: EfficiencyMetrics,
        public readonly impact: ImpactMetrics
    ) {}
}
