import { ALGORITHM_IDS } from './algorithmPolicies';
import type { MapResult } from './benchmark';
import { DEFAULT_EPISODE_CONFIG, type EpisodeConfig } from './episode';
import { applyGeneration, networkOf, noiseSeedFor, type EsSettings, type EsState } from './evolutionStrategy';
import { DEFAULT_WARM_START_SETTINGS, warmStart, type DemonstrationCollector, type WarmStartRound } from './imitation';
import { SEED_RANGES } from './lawnGenerator';
import type { NetworkData } from './policyNetwork';
import { createRandom, randomInt } from './random';
import { NETWORK_ID, type SimTask, type SimTaskResult } from './tasks';

/** Runs simulation tasks in parallel: Web Workers in the browser, worker threads in Node. */
export interface TaskRunner {
    readonly size: number;
    run(task: SimTask): Promise<SimTaskResult>;
}

/**
 * Training stops a run that cuts nothing for a quarter of the lawn area, not a whole
 * area as in the benchmark: a looping network wastes less time and is punished the same way.
 */
const TRAINING_EPISODE_CONFIG: EpisodeConfig = { ...DEFAULT_EPISODE_CONFIG, stallStepsPerTile: 0.25 };

/** Lawns used to pick the best network during training; never the test lawns. */
export const VALIDATION_LAWNS = 24;

/** Held-out lawns for the final proof; training and validation never use them. */
export const TEST_LAWNS = 60;

/** The first `count` seeds of a seed range. */
export const seedsOf = (set: keyof typeof SEED_RANGES, count: number): number[] =>
    Array.from({ length: count }, (_, i) => SEED_RANGES[set] + i);

const validationSeeds = seedsOf('validation', VALIDATION_LAWNS);

/** Fresh training lawns every generation, all from the training seed range. */
export const trainingLawnSeeds = (generation: number, count: number): number[] => {
    const random = createRandom(generation * 7919 + 17);
    return Array.from({ length: count }, () => randomInt(random, SEED_RANGES.training, SEED_RANGES.validation - 1));
};

const chunk = <T>(items: T[], parts: number): T[][] => {
    const size = Math.ceil(items.length / Math.max(1, parts));
    return Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));
};

/** Every algorithm (and the network, when given) on each lawn, one lawn per task. */
export const runBenchmark = async (runner: TaskRunner, lawnSeeds: number[], network?: NetworkData, algorithms = ALGORITHM_IDS): Promise<MapResult[]> => {
    const responses = await Promise.all(lawnSeeds.map(seed => runner.run({ kind: 'benchmark', lawnSeeds: [seed], algorithms, network })));
    return responses.flatMap(r => (r.kind === 'benchmark' ? r.results : []));
};

/**
 * Imitation warm start: the workers collect the teacher's labels lawn by lawn,
 * this thread trains the network. Writes the trained parameters into `state`.
 */
export const runWarmStart = async (
    state: EsState,
    runner: TaskRunner,
    onRound?: (progress: WarmStartRound) => void,
    settings = DEFAULT_WARM_START_SETTINGS,
): Promise<WarmStartRound> => {
    const collect: DemonstrationCollector = async (network, lawnSeeds, teacherShare) => {
        const responses = await Promise.all(lawnSeeds.map(lawnSeed =>
            runner.run({ kind: 'collect', network, teacher: settings.teacher, lawnSeed, teacherShare })));
        return responses.flatMap(r => (r.kind === 'collect' ? [r.batch] : []));
    };
    return warmStart(networkOf(state), collect, settings, onRound);
};

/** One generation: scores all mirrored pairs on the same lawns, then updates `state`. Returns the mean cost per tile. */
export const trainGeneration = async (state: EsState, settings: EsSettings, runner: TaskRunner): Promise<number> => {
    const lawnSeeds = trainingLawnSeeds(state.generation, settings.lawnsPerGeneration);
    const noiseSeeds = Array.from({ length: settings.pairs }, (_, pair) => noiseSeedFor(state.generation, pair));
    // Two tasks per worker keep all workers busy when some lawns take longer.
    const responses = await Promise.all(chunk(noiseSeeds, runner.size * 2).map(seeds => runner.run({
        kind: 'score-pairs',
        network: networkOf(state),
        sigma: settings.sigma,
        noiseSeeds: seeds,
        lawnSeeds,
        config: TRAINING_EPISODE_CONFIG,
    })));
    const results = responses.flatMap(r => (r.kind === 'score-pairs' ? r.results : []));
    applyGeneration(state, settings, results);
    return -results.reduce((sum, r) => sum + r.plus + r.minus, 0) / (2 * results.length);
};

/** Cost per tile of the network on each validation lawn. */
export const validationCosts = async (state: EsState, runner: TaskRunner): Promise<number[]> =>
    (await runBenchmark(runner, validationSeeds, networkOf(state), [])).map(r => r.runs[NETWORK_ID].cost);

/** Cost per tile of the best algorithm on each validation lawn: the bar the network must clear. */
export const bestAlgorithmCosts = async (runner: TaskRunner): Promise<number[]> =>
    (await runBenchmark(runner, validationSeeds)).map(r => Math.min(...Object.values(r.runs).map(run => run.cost)));

export interface ValidationSummary {
    meanCost: number;
    meanBestAlgorithmCost: number;
    /** Lawns where the network is cheaper than every algorithm. */
    wins: number;
    lawns: number;
}

export const summarizeValidation = (networkCosts: number[], bestCosts: number[]): ValidationSummary => ({
    meanCost: networkCosts.reduce((a, b) => a + b, 0) / networkCosts.length,
    meanBestAlgorithmCost: bestCosts.reduce((a, b) => a + b, 0) / bestCosts.length,
    wins: networkCosts.filter((cost, i) => cost < bestCosts[i] - 1e-9).length,
    lawns: networkCosts.length,
});
