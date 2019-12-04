import { Worker, isMainThread, parentPort, workerData } from './worker_threads';
/**
 * Returns true if running in th browser (if not, then we're in NodeJS)
 */
export declare function isBrowser(): boolean;
export declare function browserSupportsWebWorkers(): boolean;
export declare function nodeSupportsWorkerThreads(): boolean;
export declare function getWorkerThreads(): {
    Worker: Worker;
    isMainThread: isMainThread;
    parentPort: parentPort;
    workerData: workerData;
} | null;
