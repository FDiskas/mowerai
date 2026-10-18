import { CELL_TYPES, DEFAULT_MAX_BATTERY } from '../constants';
import { getDFSCoverageMove, hasAdjacentGrass, MOVE_HEADINGS, prepareNNInputs } from '../algorithms';
import type { NeuralNetwork } from '../NeuralNetwork';
import type { Grid, Point, State } from '../types';
import { advanceMower, startEpisode } from './episode';

/** One expert decision: the network inputs and the expert's heading as a one-hot target. */
export interface Demonstration {
    inputs: number[];
    targets: number[];
}

export interface ImitationResult {
    /** Mean cross-entropy loss of the last epoch. */
    loss: number;
    /** Share of demonstrations where the network's top output is the expert's heading. */
    accuracy: number;
}

export interface ImitationRequest {
    layers: number[];
    weights: number[];
    lawns: Grid[];
    dockPos: Point;
    turnCost: number;
    epochs: number;
}

export interface ImitationResponse extends ImitationResult {
    weights: number[];
    samples: number;
}

const ORIENTATIONS: NonNullable<State['orientation']>[] = ['horizontal', 'vertical'];
/** Step budget per demonstration run, as a multiple of the lawn area. */
const STEPS_PER_TILE = 3;

const oneHotHeading = (from: Point, to: Point): number[] =>
    MOVE_HEADINGS.map(({ dx, dy }) => (to.x - from.x === dx && to.y - from.y === dy ? 1 : 0));

const argmax = (values: number[]): number => values.indexOf(Math.max(...values));

/**
 * Drives Snake Fill (`dfs_coverage`) over every lawn in both orientations and records its
 * moves. Only steps next to fresh grass are kept: elsewhere the network is not asked.
 */
export const collectDemonstrations = (lawns: Grid[], dockPos: Point, turnCost: number): Demonstration[] => {
    const demonstrations: Demonstration[] = [];
    for (const lawn of lawns) {
        for (const orientation of ORIENTATIONS) {
            const state = startEpisode(lawn, dockPos, { battery: DEFAULT_MAX_BATTERY, orientation, turnCost });
            const maxSteps = lawn.length * lawn[0].length * STEPS_PER_TILE;
            for (let step = 0; step < maxSteps; step++) {
                const move = getDFSCoverageMove(state, state.grid, state.prevDir, CELL_TYPES);
                if (!move) break;
                if (hasAdjacentGrass(state.pos, state.grid, CELL_TYPES)) {
                    demonstrations.push({
                        inputs: prepareNNInputs(state, state.grid, CELL_TYPES),
                        targets: oneHotHeading(state.pos, move),
                    });
                }
                advanceMower(state, move);
            }
        }
    }
    return demonstrations;
};

const shuffle = <T>(items: T[]): T[] => {
    for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
};

/** Behaviour cloning: supervised training of `nn` on the expert's moves. */
export const imitateExpert = (nn: NeuralNetwork, demonstrations: Demonstration[], epochs: number): ImitationResult => {
    if (demonstrations.length === 0) return { loss: 0, accuracy: 0 };
    const order = [...demonstrations];
    let loss = 0;
    for (let epoch = 0; epoch < epochs; epoch++) {
        loss = 0;
        for (const { inputs, targets } of shuffle(order)) loss += nn.train(inputs, targets);
    }
    const hits = demonstrations.filter(d => argmax(nn.predict(d.inputs)) === argmax(d.targets)).length;
    return { loss: loss / demonstrations.length, accuracy: hits / demonstrations.length };
};
