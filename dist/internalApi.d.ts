import { ThreadedClassConfig } from './api';
import { ChildInstance } from './manager';
export declare const DEFAULT_CHILD_FREEZE_TIME = 1000;
export declare type InitProps = Array<InitProp>;
export declare enum InitPropType {
    FUNCTION = "function",
    VALUE = "value"
}
export interface InitPropDescriptor {
    /** If the property is a part of the prototype (and how many levels deep) */
    inProto: number;
    enumerable: boolean;
    /** If the property has a getter */
    get: boolean;
    /** If the property has a setter */
    set: boolean;
    /** If the property is writable */
    writable: boolean;
    /** If the property is readable */
    readable: boolean;
}
export interface InitProp {
    type: InitPropType;
    key: string;
    descriptor: InitPropDescriptor;
}
export declare enum MessageType {
    INIT = "init",
    PING = "ping",
    FUNCTION = "fcn",
    REPLY = "reply",
    LOG = "log",
    SET = "set",
    KILL = "kill",
    CALLBACK = "callback"
}
export interface MessageSent {
    instanceId: string;
    cmdId: number;
}
export interface MessageInitConstr {
    cmd: MessageType.INIT;
    modulePath: string;
    className: string;
    classFunction?: Function;
    args: Array<ArgDefinition>;
    config: ThreadedClassConfig;
}
export declare type MessageInit = MessageInitConstr & MessageSent;
export interface MessagePingConstr {
    cmd: MessageType.PING;
}
export declare type MessagePing = MessagePingConstr & MessageSent;
export interface MessageFcnConstr {
    cmd: MessageType.FUNCTION;
    fcn: string;
    args: Array<ArgDefinition>;
}
export declare type MessageFcn = MessageFcnConstr & MessageSent;
export interface MessageSetConstr {
    cmd: MessageType.SET;
    property: string;
    value: ArgDefinition;
}
export declare type MessageSet = MessageSetConstr & MessageSent;
export interface MessageReplyConstr {
    cmd: MessageType.REPLY;
    replyTo: number;
    reply?: any;
    error?: Error | string;
}
export declare type MessageReply = MessageReplyConstr & MessageSent;
export interface MessageKillConstr {
    cmd: MessageType.KILL;
}
export declare type MessageKill = MessageKillConstr & MessageSent;
export interface MessageCallbackConstr {
    cmd: MessageType.CALLBACK;
    callbackId: string;
    args: Array<any>;
}
export declare type MessageCallback = MessageCallbackConstr & MessageSent;
export declare type MessageToChildConstr = MessageInitConstr | MessageFcnConstr | MessageReplyConstr | MessageSetConstr | MessageKillConstr | MessageCallbackConstr | MessagePingConstr;
export declare type MessageToChild = MessageInit | MessageFcn | MessageReply | MessageSet | MessageKill | MessageCallback | MessagePing;
export declare type MessageFromChildReplyConstr = MessageReplyConstr;
export declare type MessageFromChildReply = MessageFromChildReplyConstr & MessageSent;
export interface MessageFromChildLogConstr {
    cmd: MessageType.LOG;
    log: Array<any>;
}
export declare type MessageFromChildLog = MessageFromChildLogConstr & MessageSent;
export declare type MessageFromChildCallbackConstr = MessageCallbackConstr;
export declare type MessageFromChildCallback = MessageCallback;
export declare type MessageFromChildConstr = MessageFromChildReplyConstr | MessageFromChildLogConstr | MessageFromChildCallbackConstr;
export declare type MessageFromChild = MessageFromChildReply | MessageFromChildLog | MessageFromChildCallback;
export declare type InstanceCallbackFunction = (instance: ChildInstance, e: Error | string | null, encodedResult?: ArgDefinition) => void;
export declare type InstanceCallbackInitFunction = (instance: ChildInstance, e: Error | string | null, initProps?: InitProps) => boolean;
export declare type CallbackFunction = (e: Error | string | null, res?: ArgDefinition) => void;
export interface ArgDefinition {
    type: ArgumentType;
    original?: any;
    value: any;
}
export declare enum ArgumentType {
    STRING = "string",
    NUMBER = "number",
    UNDEFINED = "undefined",
    NULL = "null",
    OBJECT = "object",
    FUNCTION = "function",
    BUFFER = "buffer",
    OTHER = "other"
}
export interface InstanceHandle {
    id: string;
    cmdId: number;
    queue: {
        [cmdId: string]: CallbackFunction;
    };
    instance: any;
}
export declare abstract class Worker {
    protected instanceHandles: {
        [instanceId: string]: InstanceHandle;
    };
    private callbacks;
    protected disabledMultithreading: boolean;
    private _pingCount;
    private _config?;
    protected abstract killInstance(handle: InstanceHandle): void;
    protected decodeArgumentsFromParent(handle: InstanceHandle, args: Array<ArgDefinition>): any[];
    protected encodeArgumentsToParent(instance: any, args: any[]): ArgDefinition[];
    protected reply(handle: InstanceHandle, m: MessageToChild, reply: any): void;
    protected replyError(handle: InstanceHandle, m: MessageToChild, error: any): void;
    protected sendReplyToParent(handle: InstanceHandle, replyTo: number, error?: Error, reply?: any): void;
    protected sendLog(log: any[]): void;
    protected sendCallback(handle: InstanceHandle, callbackId: string, args: any[], cb: CallbackFunction): void;
    protected getAllProperties(obj: Object): string[];
    log: (...data: any[]) => void;
    logError: (...data: any[]) => void;
    protected abstract sendMessageToParent(handle: InstanceHandle | null, msg: MessageFromChildConstr, cb?: CallbackFunction): void;
    onMessageFromParent(m: MessageToChild): void;
    private startOrphanMonitoring;
}
export declare function encodeArguments(instance: any, callbacks: {
    [key: string]: Function;
}, args: any[], disabledMultithreading: boolean): ArgDefinition[];
export declare type ArgCallback = (...args: any[]) => Promise<any>;
export declare function decodeArguments(instance: () => any, args: Array<ArgDefinition>, getCallback: (arg: ArgDefinition) => ArgCallback): Array<any | ArgCallback>;
