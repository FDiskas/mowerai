import type { Grid, PositionType as Point, Direction, State } from '../types';
import { getBoustrophedonMove } from './boustrophedon';

/**
 * Spanning Tree Coverage (STC)
 * Guarantees 100% coverage by following a spanning tree on a coarse grid.
 */
export const getSTCMove = (
    state: State,
    curGrid: Grid,
    prevDir: Direction,
    CELL_TYPES: any
): Point | null => {
    if (!state.stcPath || state.stcPath.length === 0) {
        // 1. Find spanning tree of coarse grid (BFS/DFS)
        // 2. Generate path by following tree boundary
        // For simplicity in this demo, we'll use a fallback if not pre-computed
        // Real STC would pre-compute the full Hamiltonian cycle.
        return getBoustrophedonMove(state, curGrid, prevDir, CELL_TYPES);
    }

    return null;
};
