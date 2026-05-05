import { SimulationEnvironment } from '../domain/SimulationEnvironment';
import { SimulationStats } from '../domain/SimulationStats';
import { Position } from '../domain/Position';
import { CELL_TYPES, DAMAGE_PER_PASS, DAMAGE_PER_TURN } from '../constants';

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
        
        // 1. Update Grid
        const currentCell = env.grid.getCell(env.mower.pos);
        const wasGrass = currentCell.type === CELL_TYPES.GRASS;
        
        const updatedGrid = env.grid.updateCell(env.mower.pos, {
            type: wasGrass ? CELL_TYPES.MOWED : currentCell.type,
            direction: env.mower.nav.dir,
            damage: (currentCell.damage || 0) + (isTurn ? DAMAGE_PER_TURN : (wasGrass ? 0 : DAMAGE_PER_PASS))
        });

        // 2. Update Mower
        const updatedMower = env.mower.move(nextPos, cost);

        // 3. Update Stats
        let newMovement = stats.movement.addMove();
        if (isTurn) newMovement = newMovement.addTurn();
        
        let newEfficiency = stats.efficiency;
        if (wasGrass) newEfficiency = newEfficiency.addMow();

        const nextEnv = env.withMower(updatedMower).withGrid(updatedGrid);
        const nextStats = new SimulationStats(newMovement, newEfficiency, stats.impact);

        return { env: nextEnv, stats: nextStats, wasGrass };
    }
}
