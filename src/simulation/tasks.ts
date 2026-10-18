import { algorithmPolicy } from './algorithmPolicies';
import { benchmarkLawn, runModel, type MapResult } from './benchmark';
import { DEFAULT_EPISODE_CONFIG, type EpisodeConfig, type MovePolicy } from './episode';
import { perturb, type PairResult } from './evolutionStrategy';
import { collectDemonstrations, type DemonstrationBatch } from './imitation';
import { generateLawn } from './lawnGenerator';
import { networkPolicy } from './networkPolicy';
import type { NetworkData } from './policyNetwork';

/** The id the trained network has in benchmark results. */
export const NETWORK_ID = 'neural_network';

/** Work a simulation worker does: the same code runs in browser Web Workers and Node worker threads. */
export type SimTask =
    | {
        kind: 'score-pairs';
        network: NetworkData;
        sigma: number;
        noiseSeeds: number[];
        lawnSeeds: number[];
        config?: EpisodeConfig;
    }
    | {
        kind: 'benchmark';
        lawnSeeds: number[];
        algorithms: string[];
        network?: NetworkData;
        config?: EpisodeConfig;
    }
    | {
        kind: 'collect';
        network: NetworkData;
        teacher: string;
        lawnSeed: number;
        teacherShare: number;
    };

export type SimTaskResult =
    | { kind: 'score-pairs'; results: PairResult[] }
    | { kind: 'benchmark'; results: MapResult[] }
    | { kind: 'collect'; batch: DemonstrationBatch };

/** Mean score (higher is better: minus the cost per tile) of a network over lawns. */
export const scoreNetwork = (network: NetworkData, lawnSeeds: number[], config = DEFAULT_EPISODE_CONFIG): number => {
    const policy = networkPolicy(network);
    const total = lawnSeeds.reduce((sum, seed) => sum + runModel(generateLawn(seed), policy, config).cost, 0);
    return -total / lawnSeeds.length;
};

const scorePairs = (task: Extract<SimTask, { kind: 'score-pairs' }>): PairResult[] => {
    const { network, sigma, noiseSeeds, lawnSeeds, config } = task;
    const buffer = new Float32Array(network.params.length);
    const scoreWith = (noiseSeed: number, sign: 1 | -1) =>
        scoreNetwork({ layers: network.layers, params: perturb(network.params, noiseSeed, sign, sigma, buffer) }, lawnSeeds, config);
    return noiseSeeds.map(noiseSeed => ({ noiseSeed, plus: scoreWith(noiseSeed, 1), minus: scoreWith(noiseSeed, -1) }));
};

const benchmark = ({ lawnSeeds, algorithms, network, config }: Extract<SimTask, { kind: 'benchmark' }>): MapResult[] => {
    const policies: Record<string, () => MovePolicy> = Object.fromEntries(algorithms.map(id => [id, () => algorithmPolicy(id)]));
    if (network) policies[NETWORK_ID] = () => networkPolicy(network);
    return lawnSeeds.map(seed => benchmarkLawn(generateLawn(seed), seed, policies, config));
};

export const runSimTask = (task: SimTask): SimTaskResult => {
    switch (task.kind) {
        case 'score-pairs': return { kind: 'score-pairs', results: scorePairs(task) };
        case 'benchmark': return { kind: 'benchmark', results: benchmark(task) };
        case 'collect': return {
            kind: 'collect',
            batch: collectDemonstrations(task.network, task.teacher, task.lawnSeed, task.teacherShare),
        };
    }
};
