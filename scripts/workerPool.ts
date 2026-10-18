import { availableParallelism } from 'node:os';
import { Worker } from 'node:worker_threads';
import { TaskPool, type TaskPort } from '../src/simulation/taskPool';

const threadPort = (): TaskPort => {
    const worker = new Worker(new URL('./simWorker.js', import.meta.url));
    return {
        post(task, done, fail) {
            worker.once('message', result => {
                worker.removeAllListeners('error');
                done(result);
            });
            worker.once('error', error => {
                worker.removeAllListeners('message');
                fail(error);
            });
            worker.postMessage(task);
        },
        close: () => void worker.terminate(),
    };
};

/** A task pool with one worker thread per spare CPU core. */
export const createWorkerPool = (size = Math.max(1, availableParallelism() - 1)): TaskPool =>
    new TaskPool(Array.from({ length: size }, threadPort));
