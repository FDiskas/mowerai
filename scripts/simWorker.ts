import { parentPort } from 'node:worker_threads';
import { runSimTask, type SimTask } from '../src/simulation/tasks';

const port = parentPort;
if (!port) throw new Error('simWorker must run as a worker thread');
port.on('message', (task: SimTask) => port.postMessage(runSimTask(task)));
