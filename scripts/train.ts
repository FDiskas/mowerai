import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { createEsState, DEFAULT_ES_SETTINGS, networkOf, type EsSettings, type EsState } from '../src/simulation/evolutionStrategy';
import { DEFAULT_WARM_START_SETTINGS } from '../src/simulation/imitation';
import { parseModelFile, toModelFile } from '../src/simulation/modelFile';
import { NETWORK_LAYERS } from '../src/simulation/networkPolicy';
import { bestAlgorithmCosts, runWarmStart, summarizeValidation, trainGeneration, validationCosts } from '../src/simulation/trainer';
import { createWorkerPool } from './workerPool';

const { values: args } = parseArgs({
    options: {
        generations: { type: 'string', default: '200' },
        checkpoint: { type: 'string', default: 'training/checkpoint.json' },
        model: { type: 'string', default: 'public/models/policy.json' },
        'validate-every': { type: 'string', default: '10' },
        fresh: { type: 'boolean', default: false },
        seed: { type: 'string', default: '1' },
        pairs: { type: 'string' },
        sigma: { type: 'string' },
        'learning-rate': { type: 'string' },
        lawns: { type: 'string' },
    },
});

const settings: EsSettings = {
    pairs: Number(args.pairs ?? DEFAULT_ES_SETTINGS.pairs),
    sigma: Number(args.sigma ?? DEFAULT_ES_SETTINGS.sigma),
    learningRate: Number(args['learning-rate'] ?? DEFAULT_ES_SETTINGS.learningRate),
    weightDecay: DEFAULT_ES_SETTINGS.weightDecay,
    lawnsPerGeneration: Number(args.lawns ?? DEFAULT_ES_SETTINGS.lawnsPerGeneration),
};

interface Checkpoint {
    layers: number[];
    params: number[];
    m: number[];
    v: number[];
    generation: number;
    bestValidationCost: number;
}

const writeJson = (path: string, data: unknown) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(data));
};

const loadCheckpoint = (): { state: EsState; bestValidationCost: number } | null => {
    if (args.fresh || !existsSync(args.checkpoint)) return null;
    const saved = JSON.parse(readFileSync(args.checkpoint, 'utf8')) as Checkpoint;
    if (saved.layers.join() !== NETWORK_LAYERS.join()) return null;
    return {
        state: {
            layers: saved.layers,
            params: Float32Array.from(saved.params),
            m: Float32Array.from(saved.m),
            v: Float32Array.from(saved.v),
            generation: saved.generation,
        },
        bestValidationCost: saved.bestValidationCost,
    };
};

/** Without a checkpoint, training continues from the saved model (optimizer moments start at zero). */
const loadModel = (): { state: EsState; bestValidationCost: number } | null => {
    if (args.fresh || !existsSync(args.model)) return null;
    const { network, generation, validationCost } = parseModelFile(readFileSync(args.model, 'utf8'));
    const size = network.params.length;
    return {
        state: { layers: network.layers, params: network.params, m: new Float32Array(size), v: new Float32Array(size), generation },
        bestValidationCost: validationCost ?? Infinity,
    };
};

const saveCheckpoint = (state: EsState, bestValidationCost: number) => writeJson(args.checkpoint, {
    layers: state.layers,
    params: Array.from(state.params),
    m: Array.from(state.m),
    v: Array.from(state.v),
    generation: state.generation,
    bestValidationCost,
} satisfies Checkpoint);

const main = async () => {
    const pool = createWorkerPool();
    try {
        const resumed = loadCheckpoint() ?? loadModel();
        const state = resumed?.state ?? createEsState(NETWORK_LAYERS, Number(args.seed));
        let bestValidationCost = resumed?.bestValidationCost ?? Infinity;
        const lastGeneration = state.generation + Number(args.generations);
        const validateEvery = Number(args['validate-every']);
        console.log(`${resumed ? 'Resuming at' : 'Starting'} generation ${state.generation} on ${pool.size} threads, settings ${JSON.stringify(settings)}`);

        const bestCosts = await bestAlgorithmCosts(pool);
        const validate = async () => {
            const summary = summarizeValidation(await validationCosts(state, pool), bestCosts);
            const isBest = summary.meanCost < bestValidationCost;
            console.log(`  validation: network ${summary.meanCost.toFixed(3)}, best algorithm ${summary.meanBestAlgorithmCost.toFixed(3)}, network wins ${summary.wins}/${summary.lawns}${isBest ? '  (new best, saved)' : ''}`);
            if (isBest) {
                bestValidationCost = summary.meanCost;
                writeJson(args.model, toModelFile({ network: networkOf(state), generation: state.generation, validationCost: summary.meanCost }));
            }
            saveCheckpoint(state, bestValidationCost);
        };

        if (!resumed) {
            const started = Date.now();
            await runWarmStart(state, pool, ({ round, samples, loss }) =>
                console.log(`warm start round ${round}: ${samples} states from '${DEFAULT_WARM_START_SETTINGS.teacher}', loss ${loss.toFixed(3)} (${((Date.now() - started) / 1000).toFixed(0)} s)`));
            await validate();
        }

        while (state.generation < lastGeneration) {
            const started = Date.now();
            const trainingCost = await trainGeneration(state, settings, pool);
            console.log(`gen ${state.generation}: training cost/tile ${trainingCost.toFixed(3)} (${((Date.now() - started) / 1000).toFixed(1)} s)`);

            if (state.generation % validateEvery === 0 || state.generation === lastGeneration) await validate();
        }
    } finally {
        pool.close();
    }
};

await main();
