import type { Grid, PositionType as Point, State } from '../types';
import { findPathToTarget, getClosestGrass } from './pathfinding';

/**
 * Spiral Coverage Algorithm
 */
export const getSpiralMove = (
    state: State,
    curGrid: Grid,
    CELL_TYPES: any
): Point | null => {
    const { pos } = state;
    const rows = curGrid.length;
    const cols = curGrid[0].length;

    if (state.spiralStep === undefined) {
        state.spiralStep = 1;
        state.spiralCenter = { ...pos };
    }

    const getSpiralPos = (step: number, center: Point): Point => {
        let x = center.x;
        let y = center.y;
        let currentStep = 0;
        let legLength = 1;
        let dirIdx = 0;
        const legDirs = [{ dx: 1, dy: 0 }, { dx: 0, dy: -1 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }];

        while (currentStep < step) {
            for (let i = 0; i < 2 && currentStep < step; i++) {
                for (let j = 0; j < legLength && currentStep < step; j++) {
                    x += legDirs[dirIdx].dx;
                    y += legDirs[dirIdx].dy;
                    currentStep++;
                }
                dirIdx = (dirIdx + 1) % 4;
            }
            legLength++;
        }
        return { x, y };
    };

    let attempts = 0;
    while (attempts < 100) {
        const target = getSpiralPos(state.spiralStep!, state.spiralCenter!);
        if (target.x >= 0 && target.x < cols && target.y >= 0 && target.y < rows) {
            if (curGrid[target.y][target.x].type === CELL_TYPES.GRASS) {
                state.spiralStep!++;
                return target;
            }
            state.spiralStep!++;
        } else {
             // Out of bounds, reset spiral
             state.spiralStep = 1;
             const nextGrass = getClosestGrass(pos, curGrid, CELL_TYPES);
             if (!nextGrass) return null;
             state.spiralCenter = nextGrass;
             break;
        }
        attempts++;
    }

    return findPathToTarget(pos, curGrid, { dx: 0, dy: 0 }, (p) => curGrid[p.y][p.x].type === CELL_TYPES.GRASS);
};
