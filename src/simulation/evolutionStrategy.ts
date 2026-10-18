import { fillGaussian } from './random';
import { initialParameters, type NetworkData } from './policyNetwork';

/**
 * OpenAI-style evolution strategies: try the network with small random changes
 * in both directions (mirrored pairs), rank the results, and move the
 * parameters towards the changes that ranked higher (Adam step).
 */
export interface EsSettings {
    /** Mirrored pairs per generation; the population is twice this. */
    pairs: number;
    /** Size of the random change. */
    sigma: number;
    learningRate: number;
    /** L2 pull towards zero, keeps the weights small. */
    weightDecay: number;
    /** Training lawns per generation; every member is scored on the same lawns. */
    lawnsPerGeneration: number;
}

/**
 * Small steps: the evolution fine-tunes a network that the imitation warm start
 * already made good. With learning rate 0.002 and 8 lawns per generation the
 * network drifted from 2.188 to 2.20–2.27 cost/tile (2026-10-18), so the steps
 * are smaller and every generation sees more lawns.
 */
export const DEFAULT_ES_SETTINGS: EsSettings = {
    pairs: 48,
    sigma: 0.01,
    learningRate: 0.0005,
    weightDecay: 0.005,
    lawnsPerGeneration: 16,
};

/** Everything needed to continue training later. */
export interface EsState {
    layers: number[];
    params: Float32Array;
    /** Adam first and second moments. */
    m: Float32Array;
    v: Float32Array;
    generation: number;
}

/** One mirrored pair: the score with +noise and with −noise (higher is better). */
export interface PairResult {
    noiseSeed: number;
    plus: number;
    minus: number;
}

const BETA1 = 0.9;
const BETA2 = 0.999;
const EPSILON = 1e-8;

export const createEsState = (layers: number[], seed: number): EsState => {
    const params = initialParameters(layers, seed);
    return { layers, params, m: new Float32Array(params.length), v: new Float32Array(params.length), generation: 0 };
};

export const networkOf = (state: EsState): NetworkData => ({ layers: state.layers, params: state.params });

/** A different noise seed for every pair of every generation. */
export const noiseSeedFor = (generation: number, pair: number): number =>
    (Math.imul(generation + 1, 0x9E3779B1) ^ Math.imul(pair + 1, 0x85EBCA77)) >>> 0;

/** `params + sign · sigma · noise(noiseSeed)`, written into `out`. */
export const perturb = (
    params: Float32Array,
    noiseSeed: number,
    sign: 1 | -1,
    sigma: number,
    out: Float32Array,
): Float32Array => {
    fillGaussian(out, noiseSeed);
    for (let i = 0; i < out.length; i++) out[i] = params[i] + sign * sigma * out[i];
    return out;
};

/** Ranks scaled to [−0.5, 0.5]: robust against a few very good or very bad runs. */
export const centeredRanks = (values: number[]): number[] => {
    const order = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
    const ranks = new Array<number>(values.length);
    const denominator = Math.max(1, values.length - 1);
    order.forEach(({ index }, rank) => {
        ranks[index] = rank / denominator - 0.5;
    });
    return ranks;
};

/** Applies one generation's results to `state` in place. */
export const applyGeneration = (state: EsState, settings: EsSettings, results: PairResult[]): void => {
    const { params, m, v } = state;
    const ranks = centeredRanks(results.flatMap(r => [r.plus, r.minus]));
    const gradient = new Float32Array(params.length);
    const noise = new Float32Array(params.length);
    results.forEach((result, i) => {
        const weight = ranks[2 * i] - ranks[2 * i + 1];
        if (weight === 0) return;
        fillGaussian(noise, result.noiseSeed);
        for (let p = 0; p < gradient.length; p++) gradient[p] += weight * noise[p];
    });

    state.generation++;
    const scale = 1 / (results.length * 2 * settings.sigma);
    const t = state.generation;
    const correction1 = 1 - BETA1 ** t;
    const correction2 = 1 - BETA2 ** t;
    for (let p = 0; p < params.length; p++) {
        const g = gradient[p] * scale - settings.weightDecay * params[p];
        m[p] = BETA1 * m[p] + (1 - BETA1) * g;
        v[p] = BETA2 * v[p] + (1 - BETA2) * g * g;
        params[p] += settings.learningRate * (m[p] / correction1) / (Math.sqrt(v[p] / correction2) + EPSILON);
    }
};
