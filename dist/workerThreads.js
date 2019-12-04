"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const lib_1 = require("./lib");
const WorkerThreads = lib_1.getWorkerThreads();
const Worker = WorkerThreads ? WorkerThreads.Worker : undefined;
/** Functions for spawning worker-threads in NodeJS */
function forkWorkerThread(pathToWorker) {
    return new WorkerThread(pathToWorker);
}
exports.forkWorkerThread = forkWorkerThread;
class WorkerThread extends events_1.EventEmitter {
    constructor(pathToWorker) {
        super();
        this.killed = false;
        this.pid = 0;
        this.connected = true;
        // @ts-ignore
        // this.worker = new window.Worker(pathToWorker)
        if (!Worker)
            throw new Error('Unable to create Worker thread! Not supported!');
        this.worker = new Worker(pathToWorker, {
            workerData: ''
        });
        this.worker.on('message', (message) => {
            this.emit('message', message);
            // if (message.type === 'message') {
            // } else console.log('unknown message type', message)
        });
        this.worker.on('error', (error) => {
            console.error('Worker Thread error', error);
        });
        this.worker.on('exit', (_code) => {
            this.emit('close');
        });
        this.worker.on('close', () => {
            this.emit('close');
        });
    }
    kill() {
        this.worker.terminate(() => {
            this.emit('close');
        });
        // throw new Error('Function kill in Worker Threads is not implemented.')
    }
    send(message) {
        this.worker.postMessage(message);
        // this.worker.onMessageFromParent(m)
        return true;
    }
    disconnect() {
        throw new Error('Function disconnect in Worker Threads is not implemented.');
    }
    unref() {
        throw new Error('Function unref in Worker Threads is not implemented.');
    }
    ref() {
        throw new Error('Function ref in Worker Threads is not implemented.');
    }
}
exports.WorkerThread = WorkerThread;
//# sourceMappingURL=workerThreads.js.map