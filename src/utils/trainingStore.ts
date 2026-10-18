import { NeuralNetwork } from '../NeuralNetwork';
import type { FitnessConfig } from '../types';
import { DEFAULT_FITNESS_CONFIG } from '../types';
import type { Champion, Individual } from './evolution';

/** The genetic algorithm state that the next generation is bred from. */
export interface BreedingState {
    population: Individual[];
    mutationStrength: number;
    stagnantGenerations: number;
}

/** Everything needed to continue training after a page reload. */
export interface TrainingProgress {
    champion: Champion;
    /** Null when there is no population yet (an imported model): training then seeds one from the champion. */
    breeding: BreedingState | null;
    generation: number;
    idealFitness: number;
    fitnessConfig: FitnessConfig;
}

/** What IndexedDB holds: plain data with typed arrays, so it is stored by structured clone without JSON. */
export interface TrainingSnapshot {
    layers: number[];
    championWeights: Float64Array;
    championFitness: number;
    population: Float64Array[];
    mutationStrength: number;
    stagnantGenerations: number;
    generation: number;
    idealFitness: number;
    fitnessConfig: FitnessConfig;
}

const DB_NAME = 'mowerai';
const DB_VERSION = 1;
const STORE_NAME = 'training';
const SNAPSHOT_KEY = 'latest';

/** Number of weights and biases in a network with these layers. */
export const parameterCount = (layers: number[]): number =>
    layers.slice(1).reduce((sum, outputs, i) => sum + outputs * layers[i] + outputs, 0);

const networkFrom = (layers: number[], weights: ArrayLike<number>): NeuralNetwork => {
    const nn = new NeuralNetwork(layers);
    nn.setWeights(weights);
    return nn;
};

const weightsOf = (nn: NeuralNetwork): Float64Array => Float64Array.from(nn.getWeights());

export const toSnapshot = ({ champion, breeding, generation, idealFitness, fitnessConfig }: TrainingProgress): TrainingSnapshot => ({
    layers: [...champion.nn.layers],
    championWeights: weightsOf(champion.nn),
    championFitness: champion.fitness,
    population: breeding?.population.map(individual => weightsOf(individual.nn)) ?? [],
    mutationStrength: breeding?.mutationStrength ?? 0,
    stagnantGenerations: breeding?.stagnantGenerations ?? 0,
    generation,
    idealFitness,
    fitnessConfig,
});

/** Returns null when the snapshot was saved for another network shape. */
export const fromSnapshot = (snapshot: TrainingSnapshot, layers: number[], populationSize: number): TrainingProgress | null => {
    const sameLayers = snapshot.layers.length === layers.length && snapshot.layers.every((size, i) => size === layers[i]);
    const expectedLength = parameterCount(layers);
    const allWeightsFit = [snapshot.championWeights, ...snapshot.population].every(weights => weights.length === expectedLength);
    if (!sameLayers || !allWeightsFit) return null;

    const hasFullPopulation = snapshot.population.length === populationSize;
    return {
        champion: { nn: networkFrom(layers, snapshot.championWeights), fitness: snapshot.championFitness },
        breeding: hasFullPopulation
            ? {
                population: snapshot.population.map((weights, id) => ({ id, nn: networkFrom(layers, weights) })),
                mutationStrength: snapshot.mutationStrength,
                stagnantGenerations: snapshot.stagnantGenerations,
            }
            : null,
        generation: snapshot.generation,
        idealFitness: snapshot.idealFitness,
        // Fields added to the config after the snapshot was saved get their defaults.
        fitnessConfig: { ...DEFAULT_FITNESS_CONFIG, ...snapshot.fitnessConfig },
    };
};

const resultOf = <T>(request: IDBRequest<T>): Promise<T> =>
    new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });

let openedDb: Promise<IDBDatabase> | null = null;

const openDb = (): Promise<IDBDatabase> => {
    openedDb ??= new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    }).catch(err => {
        openedDb = null;
        throw err;
    });
    return openedDb;
};

const inStore = async <T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const db = await openDb();
    return resultOf(action(db.transaction(STORE_NAME, mode).objectStore(STORE_NAME)));
};

export const loadTrainingProgress = async (layers: number[], populationSize: number): Promise<TrainingProgress | null> => {
    const snapshot = await inStore<TrainingSnapshot | undefined>('readonly', store => store.get(SNAPSHOT_KEY));
    return snapshot ? fromSnapshot(snapshot, layers, populationSize) : null;
};

export const saveTrainingProgress = async (progress: TrainingProgress): Promise<void> => {
    // Copy the weights now, before the caller moves on to the next generation.
    const snapshot = toSnapshot(progress);
    await inStore('readwrite', store => store.put(snapshot, SNAPSHOT_KEY));
};

export const clearTrainingProgress = async (): Promise<void> => {
    await inStore('readwrite', store => store.delete(SNAPSHOT_KEY));
};
