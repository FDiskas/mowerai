import { runEpisode, type EndReason, type EpisodeConfig, type MovePolicy } from './episode';
import type { Lawn } from './lawnGenerator';
import { costPerTile, type RunTally } from './score';

export interface ModelRun {
    cost: number;
    tally: RunTally;
    endReason: EndReason;
}

export interface MapResult {
    seed: number;
    width: number;
    height: number;
    runs: Record<string, ModelRun>;
}

export interface Comparison {
    challenger: string;
    maps: number;
    wins: number;
    ties: number;
    losses: number;
    /** Mean of (challenger cost − best other cost) per tile; negative means the challenger is cheaper. */
    meanDifference: number;
    /** 95 % confidence interval of `meanDifference` (normal approximation). */
    confidenceInterval: [number, number];
    /** Two-sided sign test on wins against losses (ties left out). */
    signTestP: number;
    /** How often each other model was the best one on a map. */
    bestOtherCounts: Record<string, number>;
}

/** Differences smaller than this (cost per tile) count as a tie. */
const TIE_TOLERANCE = 1e-9;

export const runModel = (lawn: Lawn, policy: MovePolicy, config?: EpisodeConfig): ModelRun => {
    const episode = runEpisode(lawn, policy, config);
    return { cost: costPerTile(episode.tally), tally: { ...episode.tally }, endReason: episode.endReason ?? 'completed' };
};

export const benchmarkLawn = (
    lawn: Lawn,
    seed: number,
    policies: Record<string, () => MovePolicy>,
    config?: EpisodeConfig,
): MapResult => ({
    seed,
    width: lawn.grid[0].length,
    height: lawn.grid.length,
    runs: Object.fromEntries(Object.entries(policies).map(([id, create]) => [id, runModel(lawn, create(), config)])),
});

/** ln(n!) by summation; exact enough for the few hundred maps of a benchmark. */
const logFactorial = (n: number): number => {
    let sum = 0;
    for (let i = 2; i <= n; i++) sum += Math.log(i);
    return sum;
};

/** Two-sided binomial sign test with p = 0.5. */
export const signTest = (wins: number, losses: number): number => {
    const n = wins + losses;
    if (n === 0) return 1;
    const k = Math.min(wins, losses);
    let tail = 0;
    for (let i = 0; i <= k; i++) {
        tail += Math.exp(logFactorial(n) - logFactorial(i) - logFactorial(n - i) - n * Math.LN2);
    }
    return Math.min(1, 2 * tail);
};

const meanAndInterval = (values: number[]): { mean: number; interval: [number, number] } => {
    const n = values.length;
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const variance = n > 1 ? values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (n - 1) : 0;
    const half = 1.96 * Math.sqrt(variance / n);
    return { mean, interval: [mean - half, mean + half] };
};

/** The challenger against the best of `others` on each map. */
export const compareToBestOther = (results: MapResult[], challenger: string, others: string[]): Comparison => {
    let wins = 0;
    let ties = 0;
    let losses = 0;
    const bestOtherCounts: Record<string, number> = {};
    const differences = results.map(({ runs }) => {
        const bestOther = others.reduce((best, id) => (runs[id].cost < runs[best].cost ? id : best));
        bestOtherCounts[bestOther] = (bestOtherCounts[bestOther] ?? 0) + 1;
        const difference = runs[challenger].cost - runs[bestOther].cost;
        if (Math.abs(difference) <= TIE_TOLERANCE) ties++;
        else if (difference < 0) wins++;
        else losses++;
        return difference;
    });
    const { mean, interval } = meanAndInterval(differences);
    return {
        challenger,
        maps: results.length,
        wins,
        ties,
        losses,
        meanDifference: mean,
        confidenceInterval: interval,
        signTestP: signTest(wins, losses),
        bestOtherCounts,
    };
};

/** Mean cost per tile of each model over all maps. */
export const meanCosts = (results: MapResult[]): Record<string, number> => {
    const ids = Object.keys(results[0]?.runs ?? {});
    return Object.fromEntries(ids.map(id => [id, results.reduce((sum, r) => sum + r.runs[id].cost, 0) / results.length]));
};
