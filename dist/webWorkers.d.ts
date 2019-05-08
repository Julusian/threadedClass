/// <reference types="node" />
import { Writable, Readable } from 'stream';
import { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
/** Functions for emulating child-process in web-workers */
export declare function forkWebWorker(pathToWorker: string): WebWorkerProcess;
export declare class WebWorkerProcess extends EventEmitter implements ChildProcess {
    stdin: Writable;
    stdout: Readable;
    stderr: Readable;
    readonly stdio: [Writable, // stdin
    Readable, // stdout
    Readable, // stderr
    // stderr
    Readable | Writable | null | undefined, // extra, no modification
    // extra, no modification
    Readable | Writable | null | undefined];
    killed: boolean;
    pid: number;
    connected: boolean;
    private worker;
    constructor(pathToWorker: string);
    kill(): void;
    send(message: any): boolean;
    disconnect(): void;
    unref(): void;
    ref(): void;
}
