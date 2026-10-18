import { CELL_TYPES } from '../constants';
import type { Point } from '../types';
import { ALGORITHM_IDS, algorithmPolicy } from './algorithmPolicies';
import { runModel } from './benchmark';
import { Episode, type MovePolicy } from './episode';
import { ImitationTrainer, type Demonstration } from './imitationTrainer';
import { generateLawn, SEED_RANGES } from './lawnGenerator';
import { actionOfMove, networkPolicy, OBSERVATION_SIZE, observe } from './networkPolicy';
import type { NetworkData } from './policyNetwork';
import { createRandom } from './random';
import { runCost } from './score';

/** Chooses the move a teacher would make in the current state of `episode`. */
type Teacher = (episode: Episode) => Point | null;

/** Teacher id: the cheapest algorithm on each lawn. */
export const BEST_ALGORITHM_TEACHER = 'best';
/** Teacher id: Smart AI improved by one step of rollout lookahead (see `rolloutTeacher`). */
export const ROLLOUT_TEACHER = 'rollout';

/** Total cost of finishing the job with `base` after first moving to `move`. */
const rolloutCost = (episode: Episode, move: Point, base: MovePolicy): number => {
    const trial = episode.clone();
    let isFirst = true;
    const policy: MovePolicy = (state, known) => {
        if (!isFirst) return base(state, known);
        isFirst = false;
        return move;
    };
    while (!trial.isFinished) trial.step(policy);
    return runCost(trial.tally);
};

const NEIGHBOURS = [{ dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }];

/**
 * Rollout teacher (one step of policy iteration): tries every legal move,
 * lets `base` finish the job from there, and picks the cheapest (the first
 * one on a tie). Finishing the job runs on the real lawn, so the teacher knows
 * more than the mower; it only labels training data and never drives in the
 * benchmark. Measured 2026-10-18 with Smart AI as `base`: 2.019 cost/tile on
 * the validation lawns, against 2.193 for the best algorithm on each lawn.
 * The same lookahead on the known map instead of the real lawn gave only
 * 2.322, so the teacher's edge comes from what it knows about the real lawn.
 */
export const rolloutTeacher = (base: MovePolicy): Teacher => episode => {
    const { pos } = episode.state;
    const moves = NEIGHBOURS
        .map(d => ({ x: pos.x + d.dx, y: pos.y + d.dy }))
        .filter(p => {
            const tile = episode.known.grid[p.y]?.[p.x];
            return tile !== undefined && tile.type !== CELL_TYPES.OBSTACLE;
        });
    if (moves.length <= 1) return moves[0] ?? null;
    let best: Point | null = null;
    let bestCost = Infinity;
    for (const move of moves) {
        const cost = rolloutCost(episode, move, base);
        if (cost < bestCost) {
            bestCost = cost;
            best = move;
        }
    }
    return best;
};

const cheapestAlgorithmOn = (lawnSeed: number): string => {
    const lawn = generateLawn(lawnSeed);
    const costs = ALGORITHM_IDS.map(id => ({ id, cost: runModel(lawn, algorithmPolicy(id)).cost }));
    return costs.reduce((best, next) => (next.cost < best.cost ? next : best)).id;
};

const asTeacher = (policy: MovePolicy): Teacher => episode => policy(episode.state, episode.known);

/** A teacher id is an algorithm id, `BEST_ALGORITHM_TEACHER` or `ROLLOUT_TEACHER`. */
const teacherFor = (teacherId: string, lawnSeed: number): Teacher => {
    if (teacherId === ROLLOUT_TEACHER) return rolloutTeacher(algorithmPolicy('smart_ai'));
    if (teacherId === BEST_ALGORITHM_TEACHER) return asTeacher(algorithmPolicy(cheapestAlgorithmOn(lawnSeed)));
    return asTeacher(algorithmPolicy(teacherId));
};

/** Labelled states of one lawn as flat arrays, cheap to post between workers. */
export interface DemonstrationBatch {
    /** `OBSERVATION_SIZE` values per state. */
    inputs: Float32Array;
    actions: Uint8Array;
}

/**
 * DAgger data for one lawn: the teacher labels every mowing state, but with
 * probability `1 − teacherShare` the network drives, so the data also covers
 * the states the network itself gets into.
 */
export const collectDemonstrations = (
    network: NetworkData,
    teacherId: string,
    lawnSeed: number,
    teacherShare: number,
): DemonstrationBatch => {
    const random = createRandom(lawnSeed);
    const teacher = teacherFor(teacherId, lawnSeed);
    const learner = networkPolicy(network);
    const episode = new Episode(generateLawn(lawnSeed));
    const inputs: Float32Array[] = [];
    const actions: number[] = [];
    const mixed: MovePolicy = (state, known) => {
        const teacherMove = teacher(episode);
        if (!teacherMove) return null;
        inputs.push(observe(state, known, new Float32Array(OBSERVATION_SIZE)));
        actions.push(actionOfMove(state, teacherMove));
        return random() < teacherShare ? teacherMove : learner(state, known) ?? teacherMove;
    };
    while (!episode.isFinished) episode.step(mixed);

    const flat = new Float32Array(inputs.length * OBSERVATION_SIZE);
    inputs.forEach((input, i) => flat.set(input, i * OBSERVATION_SIZE));
    return { inputs: flat, actions: Uint8Array.from(actions) };
};

const toDemonstrations = ({ inputs, actions }: DemonstrationBatch): Demonstration[] =>
    Array.from(actions, (action, i) => ({ input: inputs.subarray(i * OBSERVATION_SIZE, (i + 1) * OBSERVATION_SIZE), action }));

export interface WarmStartSettings {
    teacher: string;
    rounds: number;
    lawnsPerRound: number;
    epochs: number;
    learningRate: number;
    batchSize: number;
}

export const DEFAULT_WARM_START_SETTINGS: WarmStartSettings = {
    teacher: ROLLOUT_TEACHER,
    rounds: 4,
    lawnsPerRound: 60,
    epochs: 6,
    learningRate: 0.001,
    batchSize: 64,
};

/** Warm-start lawns come from the upper half of the training range, away from the evolution's lawns. */
const WARM_START_SEED_OFFSET = 500_000;

/** Collects one batch per lawn; the caller decides where (workers or this thread). */
export type DemonstrationCollector = (network: NetworkData, lawnSeeds: number[], teacherShare: number) => Promise<DemonstrationBatch[]>;

export interface WarmStartRound {
    round: number;
    samples: number;
    loss: number;
}

/**
 * DAgger warm start: round 0 copies the teacher, later rounds let the network
 * drive more and more while the teacher labels every state. Trains
 * `network.params` in place on this thread, with short breaks for the event loop.
 */
export const warmStart = async (
    network: NetworkData,
    collect: DemonstrationCollector,
    settings: WarmStartSettings = DEFAULT_WARM_START_SETTINGS,
    onRound?: (progress: WarmStartRound) => void,
): Promise<WarmStartRound> => {
    const trainer = new ImitationTrainer(network);
    let data: Demonstration[] = [];
    let progress: WarmStartRound = { round: 0, samples: 0, loss: 0 };
    for (let round = 0; round < settings.rounds; round++) {
        const firstSeed = SEED_RANGES.training + WARM_START_SEED_OFFSET + round * settings.lawnsPerRound;
        const seeds = Array.from({ length: settings.lawnsPerRound }, (_, i) => firstSeed + i);
        const teacherShare = round === 0 ? 1 : 0.5 / round;
        const batches = await collect({ layers: network.layers, params: network.params.slice() }, seeds, teacherShare);
        data = data.concat(batches.flatMap(toDemonstrations));
        const learningRate = settings.learningRate / Math.sqrt(round + 1);
        const loss = await trainer.trainEpochs(data, settings.epochs, settings.batchSize, learningRate, round);
        progress = { round: round + 1, samples: data.length, loss };
        onRound?.(progress);
    }
    return progress;
};
