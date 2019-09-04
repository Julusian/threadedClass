/// <reference types="node" />
import { ChildProcess } from 'child_process';
import { ThreadedClassConfig, ThreadedClass } from './api';
import { MessageFromChild, MessageToChildConstr, InstanceCallbackFunction, InstanceCallbackInitFunction } from './internalApi';
import { EventEmitter } from 'events';
export declare class ThreadedClassManagerClass {
    private _internal;
    constructor(internal: ThreadedClassManagerClassInternal);
    /** Destroy a proxy class */
    destroy(proxy: ThreadedClass<any>): Promise<void>;
    destroyAll(): Promise<void>;
    getThreadCount(): number;
    onEvent(proxy: ThreadedClass<any>, event: string, cb: Function): {
        stop: () => void;
    };
    /**
     * Restart the thread of the proxy instance
     * @param proxy
     * @param forceRestart If true, will kill the thread and restart it
     */
    restart(proxy: ThreadedClass<any>, forceRestart?: boolean): Promise<void>;
    /**
     * Returns a description of what threading mode the library will use in the current context.
     */
    getThreadMode(): ThreadMode;
}
/**
 * The Child represents a child process, in which the proxy-classes live and run
 */
export interface Child {
    readonly id: string;
    readonly isNamed: boolean;
    readonly pathToWorker: string;
    process: ChildProcess;
    usage: number;
    instances: {
        [id: string]: ChildInstance;
    };
    methods: {
        [id: string]: {
            resolve: (result: any) => void;
            reject: (error: any) => void;
        };
    };
    alive: boolean;
    isClosing: boolean;
    config: ThreadedClassConfig;
    cmdId: number;
    queue: {
        [cmdId: string]: InstanceCallbackFunction;
    };
    callbackId: number;
    callbacks: {
        [key: string]: Function;
    };
}
export declare function childName(child: Child): string;
/**
 * The ChildInstance represents a proxy-instance of a class, running in a child process
 */
export interface ChildInstance {
    readonly id: string;
    readonly proxy: ThreadedClass<any>;
    readonly usage?: number;
    /** When to consider the process is frozen */
    readonly freezeLimit?: number;
    readonly onMessageCallback: (instance: ChildInstance, message: MessageFromChild) => void;
    readonly pathToModule: string;
    readonly className: string;
    readonly classFunction: Function;
    readonly constructorArgs: any[];
    readonly config: ThreadedClassConfig;
    initialized: boolean;
    child: Child;
}
export declare class ThreadedClassManagerClassInternal extends EventEmitter {
    /** Set to true if you want to handle the exiting of child process yourselt */
    dontHandleExit: boolean;
    private isInitialized;
    private _threadId;
    private _instanceId;
    private _methodId;
    private _children;
    private _pinging;
    getChild(config: ThreadedClassConfig, pathToWorker: string): Child;
    /**
     * Attach a proxy-instance to a child
     * @param child
     * @param proxy
     * @param onMessage
     */
    attachInstance(config: ThreadedClassConfig, child: Child, proxy: ThreadedClass<any>, pathToModule: string, className: string, classFunction: Function, constructorArgs: any[], onMessage: (instance: ChildInstance, message: MessageFromChild) => void): ChildInstance;
    killProxy(proxy: ThreadedClass<any>): Promise<void>;
    sendMessageToChild(instance: ChildInstance, messageConstr: MessageToChildConstr, cb?: any | InstanceCallbackFunction | InstanceCallbackInitFunction): void;
    getChildrenCount(): number;
    killAllChildren(): Promise<void>;
    restart(proxy: ThreadedClass<any>, forceRestart?: boolean): Promise<void>;
    restartChild(child: Child, onlyInstances?: ChildInstance[], forceRestart?: boolean): Promise<void>;
    sendInit(child: Child, instance: ChildInstance, config: ThreadedClassConfig, cb?: InstanceCallbackInitFunction): void;
    startMonitoringChild(instance: ChildInstance): void;
    doMethod<T>(child: Child, cb: (resolve: (result: T | PromiseLike<T>) => void, reject: (error: any) => void) => void): Promise<T>;
    /** Called before using internally */
    private _init;
    private _pingChild;
    private _childHasCrashed;
    private _createFork;
    private _setupChildProcess;
    private _findFreeChild;
    private killChild;
    private rejectChildMethods;
}
export declare enum ThreadMode {
    /** Web-workers, in browser */
    WEB_WORKER = "web_worker",
    /** Nothing, Web-workers not supported */
    NOT_SUPPORTED = "not_supported",
    /** Worker threads */
    WORKER_THREADS = "worker_threads",
    /** Child process */
    CHILD_PROCESS = "child_process"
}
export declare const ThreadedClassManagerInternal: ThreadedClassManagerClassInternal;
export declare const ThreadedClassManager: ThreadedClassManagerClass;
