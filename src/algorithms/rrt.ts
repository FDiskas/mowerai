import type { Grid, PositionType as Point, Direction, State } from '../types';
import { getClosestGrass } from './pathfinding';
import { getSmartAIMove } from './smartAI';

/**
 * RRT (Rapidly-exploring Random Tree) Exploration
 * Finds a path to the nearest grass by growing a random tree.
 */
export const getRRTMove = (
    state: State,
    curGrid: Grid,
    prevDir: Direction,
    CELL_TYPES: any
): Point | null => {
    const { pos } = state;
    const target = getClosestGrass(pos, curGrid, CELL_TYPES);
    if (!target) return null;

    const rows = curGrid.length;
    const cols = curGrid[0].length;
    const nodes = [{ pos, parent: -1 }];
    const maxNodes = 500;

    for (let i = 0; i < maxNodes; i++) {
        // 20% bias towards target
        const sample = Math.random() < 0.2 ? target : {
            x: Math.floor(Math.random() * cols),
            y: Math.floor(Math.random() * rows)
        };

        // Find nearest node in tree
        let nearestIdx = 0;
        let minDist = Infinity;
        for (let j = 0; j < nodes.length; j++) {
            const d = Math.abs(nodes[j].pos.x - sample.x) + Math.abs(nodes[j].pos.y - sample.y);
            if (d < minDist) { minDist = d; nearestIdx = j; }
        }

        const nearest = nodes[nearestIdx].pos;
        // Step towards sample
        const dx = Math.sign(sample.x - nearest.x);
        const dy = Math.sign(sample.y - nearest.y);

        // Only move in one axis at a time (grid)
        const nextX = nearest.x + dx;
        const nextY = nearest.y + (dx === 0 ? dy : 0);

        if (nextX >= 0 && nextX < cols && nextY >= 0 && nextY < rows && curGrid[nextY][nextX].type !== 'obstacle') {
            // Check if already in nodes
            if (!nodes.some(n => n.pos.x === nextX && n.pos.y === nextY)) {
                nodes.push({ pos: { x: nextX, y: nextY }, parent: nearestIdx });
                if (nextX === target.x && nextY === target.y) {
                    // Path found, return first move of path
                    let curr = nodes.length - 1;
                    while (nodes[curr].parent !== 0 && nodes[curr].parent !== -1) {
                        curr = nodes[curr].parent;
                    }
                    return nodes[curr].pos;
                }
            }
        }
    }

    return getSmartAIMove(state, curGrid, prevDir, CELL_TYPES);
};
