import { 
    CELL_TYPES, 
    DEFAULT_MAX_BATTERY, 
    DEFAULT_DRAIN_MOVE, 
    DEFAULT_DRAIN_TURN, 
    DAMAGE_PER_PASS, 
    DAMAGE_PER_TURN 
} from '../constants';
import type { Grid, Point, State, FitnessConfig } from '../types';
import { DEFAULT_FITNESS_CONFIG } from '../types';
import { getNeuralNetworkMove } from '../algorithms';
import { NeuralNetwork } from '../NeuralNetwork';

export class FitnessEvaluator {
    static async evaluate(
        nn: NeuralNetwork, 
        initialGrid: Grid, 
        dockPos: Point, 
        maxSteps: number,
        orientation: 'horizontal' | 'vertical' = 'horizontal',
        drainMove: number = DEFAULT_DRAIN_MOVE,
        drainTurn: number = DEFAULT_DRAIN_TURN,
        cfg: FitnessConfig = DEFAULT_FITNESS_CONFIG
    ): Promise<number> {
        const rows = initialGrid.length;
        const cols = initialGrid[0].length;
        
        // Fast grid clone
        const workingGrid: Grid = new Array(rows);
        let totalGrass = 0;
        for (let r = 0; r < rows; r++) {
            workingGrid[r] = new Array(cols);
            for (let c = 0; c < cols; c++) {
                const cell = initialGrid[r][c];
                const isGrass = cell.type === CELL_TYPES.GRASS || cell.type === CELL_TYPES.MOWED;
                if (isGrass) totalGrass++;
                workingGrid[r][c] = {
                    type: cell.type === CELL_TYPES.MOWED ? CELL_TYPES.GRASS : cell.type,
                    damage: 0,
                    direction: null
                };
            }
        }

        const state: State = {
            pos: { ...dockPos },
            prevDir: { dx: 0, dy: 1 },
            battery: DEFAULT_MAX_BATTERY,
            grid: workingGrid,
            dockPos: { ...dockPos },
            isCharging: false,
            isReturningForCharge: false,
            visitCounts: {},
            orientation: orientation,
            maxBattery: DEFAULT_MAX_BATTERY
        };

        let mowed = 0;
        let turns = 0;
        let distance = 0;
        let totalDamage = 0;
        let chargeCycles = 0;
        let penaltyPoints = 0;
        let totalDiscoveryReward = 0;
        let straightLineSteps = 0;
        let totalOrientationBonus = 0;
        let mowedRevisits = 0;
        let batteryUsed = 0;
        const maxAllowedRevisits = Math.floor(maxSteps * cfg.maxMowedRevisitRatio);
        
        const posHistory: string[] = [];

        for (let step = 0; step < maxSteps; step++) {
            const isLowBattery = (state.battery / DEFAULT_MAX_BATTERY) < 0.2;
            
            if (isLowBattery || state.isReturningForCharge) {
                state.isReturningForCharge = true;
                if (state.pos.x === state.dockPos.x && state.pos.y === state.dockPos.y) {
                    state.battery = DEFAULT_MAX_BATTERY;
                    state.isReturningForCharge = false;
                    chargeCycles++;
                }
            }

            const move = getNeuralNetworkMove(state, workingGrid, state.prevDir, CELL_TYPES, nn);
            if (!move) break;

            const dx = move.x - state.pos.x;
            const dy = move.y - state.pos.y;
            const isTurn = dx !== state.prevDir.dx || dy !== state.prevDir.dy;

            if (isTurn) turns++;
            else straightLineSteps++;
            
            distance++;

            const posKey = `${move.x},${move.y}`;
            const visitCount = (state.visitCounts[posKey] || 0) + 1;
            state.visitCounts[posKey] = visitCount;

            if (visitCount === 1) {
                totalDiscoveryReward += cfg.discoveryReward;
            }

            // Critical limit: if a NON-DOCK cell is visited too many times - stop evaluation early
            if (visitCount >= cfg.visitLimit && !(move.x === dockPos.x && move.y === dockPos.y)) {
                penaltyPoints += 10000;
                break;
            }

            let grassMowedThisStep = false;
            const cell = workingGrid[move.y][move.x];
            if (cell.type === CELL_TYPES.GRASS) {
                cell.type = CELL_TYPES.MOWED;
                mowed++;
                grassMowedThisStep = true;
            } else if (cell.type === CELL_TYPES.MOWED) {
                mowedRevisits++;
                const stepDamage = isTurn ? DAMAGE_PER_TURN : DAMAGE_PER_PASS;
                const currentDamage = cell.damage || 0;
                totalDamage += stepDamage * (1 + currentDamage * 200); 
                cell.damage = currentDamage + stepDamage;
                
                // Significantly increased penalty for revisiting to force "corner cutting" (shortest path)
                penaltyPoints += cfg.mowedRevisitPenalty * (1 + mowedRevisits * 0.5);
                
                if (mowedRevisits > maxAllowedRevisits) {
                    penaltyPoints += 50000;
                    break;
                }
            }

            state.pos = move;
            state.prevDir = { dx, dy };

            const isCorrectOrientation = 
                (orientation === 'horizontal' && dy === 0 && dx !== 0) ||
                (orientation === 'vertical' && dx === 0 && dy !== 0);
            
            // CRITICAL: Only reward orientation if we actually mowed grass!
            // This prevents "zigzagging" patterns on already mowed areas.
            if (isCorrectOrientation && !isTurn && grassMowedThisStep) {
                totalOrientationBonus += cfg.orientationBonus;
            }

            const stepDrain = drainMove + (isTurn ? drainTurn : 0);
            state.battery -= stepDrain;
            batteryUsed += stepDrain;

            posHistory.push(posKey);
            if (posHistory.length > 8) {
                posHistory.shift();
                const unique = new Set(posHistory);
                if (unique.size <= 3) {
                    penaltyPoints += cfg.oscillationPenalty;
                }
            }

            if (state.battery <= 0) {
                if (state.pos.x === state.dockPos.x && state.pos.y === state.dockPos.y) {
                    state.battery = DEFAULT_MAX_BATTERY;
                    chargeCycles++;
                } else {
                    penaltyPoints += cfg.batteryOutPenalty;
                    break;
                }
            }

            if (mowed === totalGrass && state.pos.x === state.dockPos.x && state.pos.y === state.dockPos.y) {
                penaltyPoints -= cfg.completionBonus;
                break;
            }
        }

        // Final Scores Calculation
        if (totalGrass === 0) return 0;

        // Coverage: 0 to 50,000 (scaled by percentage)
        const coverageScore = (mowed / totalGrass) * 50000;
        
        // Efficiency: (Mowed / Distance) * weight. Ideal is 1.0.
        const efficiencyScore = (distance > 0) ? (mowed / distance) * 20000 : 0;
        
        // Straight line bonus helps with systematic patterns
        const straightLineBonus = straightLineSteps * cfg.straightLineBonus;

        // Battery efficiency: (Ideal battery / Actual battery) * weight
        const batteryPerMow = mowed > 0 ? batteryUsed / mowed : 999;
        const idealBatteryPerMow = drainMove;
        const batteryEfficiencyBonus = mowed > 0
            ? Math.min(2, (idealBatteryPerMow / batteryPerMow)) * cfg.batteryEfficiencyWeight
            : 0;

        // Total Penalties
        const turnPenaltyWeight = cfg.turnPenalty + (drainTurn / drainMove) * 10;
        const totalPenalty = (turns * turnPenaltyWeight) + 
                             (totalDamage * cfg.damageWeight) + 
                             (chargeCycles * cfg.chargeCycleWeight) + 
                             (penaltyPoints);

        // Docking bonus
        const distToDock = Math.abs(state.pos.x - state.dockPos.x) + Math.abs(state.pos.y - state.dockPos.y);
        const dockBonus = distToDock === 0 ? 10000 : (1 / (distToDock + 1)) * 2000;

        const fitness = coverageScore + 
                        efficiencyScore + 
                        dockBonus + 
                        totalDiscoveryReward + 
                        straightLineBonus + 
                        totalOrientationBonus + 
                        batteryEfficiencyBonus - 
                        totalPenalty;

        return isNaN(fitness) ? -1000000 : fitness;
    }
}
