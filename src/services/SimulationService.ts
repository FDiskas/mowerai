import { SimulationEnvironment } from '../domain/SimulationEnvironment';
import { SimulationStats } from '../domain/SimulationStats';
import { Position } from '../domain/Position';
import { mowTile, headingBetween } from '../domain/MowingStep';

export interface SimulationConfig {
    drainMove: number;
    drainTurn: number;
    algo: string;
    orientation: string;
}

export class SimulationService {
    static calculateStep(
        env: SimulationEnvironment,
        stats: SimulationStats,
        nextPos: Position,
        config: SimulationConfig
    ): { env: SimulationEnvironment; stats: SimulationStats; wasGrass: boolean } {
        const isTurn = env.mower.nav.isTurning(nextPos);
        const cost = config.drainMove + (isTurn ? config.drainTurn : 0);

        // 1. Cut the current tile via the shared mowing rule.
        const currentPos = env.mower.pos;
        const heading = headingBetween(currentPos, nextPos);
        const outcome = mowTile(env.grid.getCell(currentPos), heading, isTurn);
        const updatedGrid = env.grid.updateCell(currentPos, outcome.cell);

        // 2. Update Mower
        const updatedMower = env.mower.move(nextPos, cost);

        // 3. Update Stats
        let newMovement = stats.movement.addMove();
        if (isTurn) newMovement = newMovement.addTurn();

        let newEfficiency = stats.efficiency;
        if (outcome.cutFreshGrass) newEfficiency = newEfficiency.addMow();

        const nextEnv = env.withMower(updatedMower).withGrid(updatedGrid);
        const nextStats = new SimulationStats(newMovement, newEfficiency, stats.impact);

        return { env: nextEnv, stats: nextStats, wasGrass: outcome.cutFreshGrass };
    }
}
