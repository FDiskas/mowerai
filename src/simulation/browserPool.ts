import { TaskPool, type TaskPort } from './taskPool';

const webWorkerPort = (): TaskPort => {
    const worker = new Worker(new URL('../simulation.worker.ts', import.meta.url), { type: 'module' });
    return {
        post(task, done, fail) {
            worker.onmessage = e => done(e.data);
            worker.onerror = fail;
            worker.postMessage(task);
        },
        close: () => worker.terminate(),
    };
};

/** A task pool with one Web Worker per CPU core, minus one for the page. */
export const createBrowserPool = (size = Math.max(1, (navigator.hardwareConcurrency || 4) - 1)): TaskPool =>
    new TaskPool(Array.from({ length: size }, webWorkerPort));
