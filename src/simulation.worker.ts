import { runSimTask, type SimTask } from './simulation/tasks';

// Runs training and benchmark work off the UI thread.
self.onmessage = (e: MessageEvent<SimTask>) => self.postMessage(runSimTask(e.data));
