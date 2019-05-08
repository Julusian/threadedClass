/// <reference types="node" />
import { ChildProcess } from 'child_process';
import { Writable, Readable } from 'stream';
import { EventEmitter } from 'events';
import { MessageFromChild, CallbackFunction, MessageFromChildConstr, Worker, InstanceHandle } from './internalApi';
export declare class FakeWorker extends Worker {
    private mockProcessSend;
    constructor(cb: (m: MessageFromChild) => void);
    protected killInstance(): void;
    protected sendMessageToParent(handle: InstanceHandle, msg: MessageFromChildConstr, cb?: CallbackFunction): void;
}
export declare class FakeProcess extends EventEmitter implements ChildProcess {
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
    constructor();
    kill(): void;
    send(m: any): boolean;
    disconnect(): void;
    unref(): void;
    ref(): void;
}
