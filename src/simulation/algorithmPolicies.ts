import * as algos from '../algorithms';
import { CELL_TYPES } from '../constants';
import type { Point, State } from '../types';
import type { MovePolicy } from './episode';

type AlgorithmMove = (state: State) => Point | null;

/** Hand-written algorithms, keyed by the ids in `ALGORITHMS_LIST`. Each reads only the known map in `state.grid`. */
const ALGORITHM_MOVES: Record<string, AlgorithmMove> = {
    smart_ai: s => algos.getSmartAIMove(s, s.grid, s.prevDir, CELL_TYPES),
    potential_field: s => algos.getPotentialFieldMove(s, s.grid, CELL_TYPES),
    boustrophedon: s => algos.getBoustrophedonMove(s, s.grid, s.prevDir, CELL_TYPES),
    spiral: s => algos.getSpiralMove(s, s.grid, CELL_TYPES),
    dfs_coverage: s => algos.getDFSCoverageMove(s, s.grid, s.prevDir, CELL_TYPES),
    rrt: s => algos.getRRTMove(s, s.grid, s.prevDir, CELL_TYPES),
    a_star: s => algos.getAStarMove(s, s.grid, s.prevDir, CELL_TYPES),
    energy_conservative_sweep: s => algos.getEnergyConservativeSweepMove(s, s.grid, s.prevDir, CELL_TYPES),
    cellular_decomposition: s => algos.getCellularDecompositionMove(s, s.grid, s.prevDir, CELL_TYPES),
};

export const ALGORITHM_IDS = Object.keys(ALGORITHM_MOVES);

/** Removed algorithm ids that can still come from saved history; they run as Boustrophedon. */
const LEGACY_SWEEP_IDS = ['stc', 'zigzag', 'u_shape', 'slam_boustrophedon', 'cellular_boustrophedon'];

const resolveMove = (id: string): AlgorithmMove =>
    ALGORITHM_MOVES[id] ?? (LEGACY_SWEEP_IDS.includes(id) ? ALGORITHM_MOVES.boustrophedon : ALGORITHM_MOVES.smart_ai);

/** An algorithm as a policy. When it finds no move, Smart AI takes over, as it always did in the app. */
export const algorithmPolicy = (id: string): MovePolicy => {
    const move = resolveMove(id);
    return state => move(state) ?? (id === 'smart_ai' ? null : ALGORITHM_MOVES.smart_ai(state));
};
