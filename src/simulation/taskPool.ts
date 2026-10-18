import type { SimTask, SimTaskResult } from './tasks';
import type { TaskRunner } from './trainer';

/** One worker as the pool sees it: Web Worker in the browser, worker thread in Node. */
export interface TaskPort {
    post(task: SimTask, done: (result: SimTaskResult) => void, fail: (error: unknown) => void): void;
    close(): void;
}

interface Job {
    task: SimTask;
    resolve: (result: SimTaskResult) => void;
    reject: (error: unknown) => void;
}

/** Hands queued tasks to idle workers, one task per worker at a time. */
export class TaskPool implements TaskRunner {
    private readonly ports: TaskPort[];
    private readonly idle: TaskPort[];
    private readonly queue: Job[] = [];

    constructor(ports: TaskPort[]) {
        this.ports = ports;
        this.idle = [...ports];
    }

    get size(): number {
        return this.ports.length;
    }

    run(task: SimTask): Promise<SimTaskResult> {
        return new Promise((resolve, reject) => {
            this.queue.push({ task, resolve, reject });
            this.dispatch();
        });
    }

    private dispatch(): void {
        while (this.idle.length > 0 && this.queue.length > 0) {
            const port = this.idle.pop()!;
            const job = this.queue.shift()!;
            const release = () => {
                this.idle.push(port);
                this.dispatch();
            };
            port.post(
                job.task,
                result => { release(); job.resolve(result); },
                error => { release(); job.reject(error); },
            );
        }
    }

    close(): void {
        this.ports.forEach(port => port.close());
        this.queue.splice(0).forEach(job => job.reject(new Error('Task pool closed')));
    }
}
