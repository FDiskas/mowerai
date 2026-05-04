import { 
    CELL_TYPES, 
    DEFAULT_MAX_BATTERY, 
    DEFAULT_DRAIN_MOVE, 
    DEFAULT_DRAIN_TURN, 
    DAMAGE_PER_PASS, 
    DAMAGE_PER_TURN 
} from '../constants';
import type { Grid, Point, State, Cell } from '../types';
import { getNeuralNetworkMove } from '../algorithms';
import { NeuralNetwork } from '../NeuralNetwork';

export class FitnessEvaluator {
    static async evaluate(
        nn: NeuralNetwork, 
        initialGrid: Grid, 
        dockPos: Point, 
        maxSteps: number
    ): Promise<number> {
        const state: State = {
            pos: { ...dockPos },
            prevDir: { dx: 0, dy: 1 },
            battery: DEFAULT_MAX_BATTERY,
            grid: initialGrid.map(row => row.map(cell => ({
                ...cell,
                type: cell.type === CELL_TYPES.MOWED ? CELL_TYPES.GRASS : cell.type,
                damage: 0
            }))),
            dockPos: { ...dockPos },
            isCharging: false,
            isReturningForCharge: false,
            visitCounts: {}
        };

        let mowed = 0;
        let turns = 0;
        let distance = 0;
        let totalDamage = 0;
        let chargeCycles = 0;
        let penaltyPoints = 0;
        let discoveryReward = 0;
        let straightLineSteps = 0;
        
        const totalGrass = initialGrid.flat().filter(c => c.type === CELL_TYPES.GRASS || c.type === CELL_TYPES.MOWED).length;
        const posHistory: string[] = [];

        for (let step = 0; step < maxSteps; step++) {
            const isLowBattery = (state.battery / DEFAULT_MAX_BATTERY) * 100 < 20;
            
            if (isLowBattery || state.isReturningForCharge) {
                state.isReturningForCharge = true;
                if (state.pos.x === state.dockPos.x && state.pos.y === state.dockPos.y) {
                    state.battery = DEFAULT_MAX_BATTERY;
                    state.isReturningForCharge = false;
                    chargeCycles++;
                }
            }

            const move = getNeuralNetworkMove(state, state.grid, state.prevDir, CELL_TYPES, nn);
            if (!move) break;

            const dx = move.x - state.pos.x;
            const dy = move.y - state.pos.y;
            const isTurn = dx !== state.prevDir.dx || dy !== state.prevDir.dy;

            if (isTurn) {
                turns++;
            } else {
                straightLineSteps++;
            }
            distance++;

            const posKey = `${move.x},${move.y}`;
            const isFirstVisit = !state.visitCounts[posKey];
            state.visitCounts[posKey] = (state.visitCounts[posKey] || 0) + 1;

            if (isFirstVisit) {
                discoveryReward += 50; 
            }

            const cell = state.grid[move.y][move.x];
            if (cell.type === CELL_TYPES.GRASS) {
                cell.type = CELL_TYPES.MOWED;
                mowed++;
            } else if (cell.type === CELL_TYPES.MOWED) {
                const stepDamage = isTurn ? DAMAGE_PER_TURN : DAMAGE_PER_PASS;
                const currentDamage = cell.damage || 0;
                const damageImpact = stepDamage * (1 + currentDamage * 200); 
                totalDamage += damageImpact;
                cell.damage = currentDamage + stepDamage;
                penaltyPoints += 20.0; 
            }

            state.pos = move;
            state.prevDir = { dx, dy };
            state.battery -= (DEFAULT_DRAIN_MOVE + (isTurn ? DEFAULT_DRAIN_TURN : 0));

            posHistory.push(posKey);
            if (posHistory.length > 15) {
                posHistory.shift();
                const unique = new Set(posHistory);
                if (unique.size <= 4) {
                    penaltyPoints += 100.0; 
                }
            }

            if (state.visitCounts[posKey] > 2) {
                penaltyPoints += state.visitCounts[posKey] * 50;
            }

            if (state.battery <= 0) {
                if (state.pos.x === state.dockPos.x && state.pos.y === state.dockPos.y) {
                    state.battery = DEFAULT_MAX_BATTERY;
                    chargeCycles++;
                } else {
                    penaltyPoints += 5000; 
                    break;
                }
            }

            if (mowed === totalGrass && state.pos.x === state.dockPos.x && state.pos.y === state.dockPos.y) {
                penaltyPoints -= 10000; 
                break;
            }
        }

        if (totalGrass === 0) return 0;

        const coverageScore = (mowed / totalGrass) * 100000;
        const efficiencyScore = (mowed > 0) ? (mowed / distance) * 20000 : 0;
        const straightLineBonus = straightLineSteps * 5; 
        const totalPenalty = (turns * 500) + (totalDamage * 5000) + (chargeCycles * 5000) + (penaltyPoints * 1000);

        const distToDock = Math.abs(state.pos.x - state.dockPos.x) + Math.abs(state.pos.y - state.dockPos.y);
        const dockBonus = distToDock === 0 ? 10000 : (1 / (distToDock + 1)) * 2000;

        const fitness = coverageScore + efficiencyScore + dockBonus + discoveryReward + straightLineBonus - totalPenalty;
        return isNaN(fitness) ? -10000000 : fitness;
    }
}
