import type { EsState } from '../simulation/evolutionStrategy';
import type { LoadedModel } from '../simulation/modelFile';
import { parameterCount } from '../simulation/policyNetwork';

/** Everything needed to continue training after a page reload. */
export interface TrainingProgress {
    /** The evolution strategy: current parameters and optimizer moments. */
    es: EsState;
    /** The network with the best validation score so far: the one the app drives with. */
    best: LoadedModel;
}

/** What IndexedDB holds: plain data with typed arrays, stored by structured clone without JSON. */
export interface TrainingSnapshot {
    layers: number[];
    params: Float32Array;
    m: Float32Array;
    v: Float32Array;
    generation: number;
    bestParams: Float32Array;
    bestGeneration: number;
    bestValidationCost: number | null;
}

const DB_NAME = 'mowerai';
const DB_VERSION = 1;
const STORE_NAME = 'training';
const SNAPSHOT_KEY = 'latest';

/** Copies the arrays, so training can go on while the snapshot is written. */
export const toSnapshot = ({ es, best }: TrainingProgress): TrainingSnapshot => ({
    layers: [...es.layers],
    params: es.params.slice(),
    m: es.m.slice(),
    v: es.v.slice(),
    generation: es.generation,
    bestParams: best.network.params.slice(),
    bestGeneration: best.generation,
    bestValidationCost: best.validationCost,
});

/** Returns null when the snapshot was saved for another network shape (or by an older app version). */
export const fromSnapshot = (snapshot: TrainingSnapshot, layers: number[]): TrainingProgress | null => {
    const sameLayers = snapshot.layers?.length === layers.length && snapshot.layers.every((size, i) => size === layers[i]);
    const expectedLength = parameterCount(layers);
    const arrays = [snapshot.params, snapshot.m, snapshot.v, snapshot.bestParams];
    if (!sameLayers || !arrays.every(array => array instanceof Float32Array && array.length === expectedLength)) return null;
    return {
        es: { layers, params: snapshot.params, m: snapshot.m, v: snapshot.v, generation: snapshot.generation },
        best: {
            network: { layers, params: snapshot.bestParams },
            generation: snapshot.bestGeneration,
            validationCost: snapshot.bestValidationCost,
        },
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

export const loadTrainingProgress = async (layers: number[]): Promise<TrainingProgress | null> => {
    const snapshot = await inStore<TrainingSnapshot | undefined>('readonly', store => store.get(SNAPSHOT_KEY));
    return snapshot ? fromSnapshot(snapshot, layers) : null;
};

export const saveTrainingProgress = async (progress: TrainingProgress): Promise<void> => {
    const snapshot = toSnapshot(progress);
    await inStore('readwrite', store => store.put(snapshot, SNAPSHOT_KEY));
};

export const clearTrainingProgress = async (): Promise<void> => {
    await inStore('readwrite', store => store.delete(SNAPSHOT_KEY));
};
