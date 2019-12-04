"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const lib_1 = require("./lib");
exports.DEFAULT_CHILD_FREEZE_TIME = 1000; // how long to wait before considering a child to be unresponsive
var InitPropType;
(function (InitPropType) {
    InitPropType["FUNCTION"] = "function";
    InitPropType["VALUE"] = "value";
})(InitPropType = exports.InitPropType || (exports.InitPropType = {}));
var MessageType;
(function (MessageType) {
    MessageType["INIT"] = "init";
    MessageType["PING"] = "ping";
    MessageType["FUNCTION"] = "fcn";
    MessageType["REPLY"] = "reply";
    MessageType["LOG"] = "log";
    MessageType["SET"] = "set";
    MessageType["KILL"] = "kill";
    MessageType["CALLBACK"] = "callback";
})(MessageType = exports.MessageType || (exports.MessageType = {}));
var ArgumentType;
(function (ArgumentType) {
    ArgumentType["STRING"] = "string";
    ArgumentType["NUMBER"] = "number";
    ArgumentType["UNDEFINED"] = "undefined";
    ArgumentType["NULL"] = "null";
    ArgumentType["OBJECT"] = "object";
    ArgumentType["FUNCTION"] = "function";
    ArgumentType["BUFFER"] = "buffer";
    ArgumentType["OTHER"] = "other";
})(ArgumentType = exports.ArgumentType || (exports.ArgumentType = {}));
class Worker {
    constructor() {
        this.instanceHandles = {};
        this.callbacks = {};
        this.disabledMultithreading = false;
        this._pingCount = 0;
        this.log = (...data) => {
            this.sendLog(data);
        };
        this.logError = (...data) => {
            this.sendLog(['Error', ...data]);
        };
    }
    decodeArgumentsFromParent(handle, args) {
        // Note: handle.instance could change if this was called for the constructor parameters, so it needs to be loose
        return decodeArguments(() => handle.instance, args, (a) => {
            return ((...args) => {
                return new Promise((resolve, reject) => {
                    const callbackId = a.value;
                    this.sendCallback(handle, callbackId, args, (err, encodedResult) => {
                        if (err) {
                            reject(err);
                        }
                        else {
                            const result = encodedResult ? this.decodeArgumentsFromParent(handle, [encodedResult]) : [encodedResult];
                            resolve(result[0]);
                        }
                    });
                });
            });
        });
    }
    encodeArgumentsToParent(instance, args) {
        return encodeArguments(instance, this.callbacks, args, this.disabledMultithreading);
    }
    reply(handle, m, reply) {
        this.sendReplyToParent(handle, m.cmdId, undefined, reply);
    }
    replyError(handle, m, error) {
        this.sendReplyToParent(handle, m.cmdId, error);
    }
    sendReplyToParent(handle, replyTo, error, reply) {
        let msg = {
            cmd: MessageType.REPLY,
            replyTo: replyTo,
            error: error ? (error.stack || error).toString() : error,
            reply: reply
        };
        this.sendMessageToParent(handle, msg);
    }
    sendLog(log) {
        let msg = {
            cmd: MessageType.LOG,
            log: log
        };
        this.sendMessageToParent(null, msg);
    }
    sendCallback(handle, callbackId, args, cb) {
        let msg = {
            cmd: MessageType.CALLBACK,
            callbackId: callbackId,
            args: args
        };
        this.sendMessageToParent(handle, msg, cb);
    }
    getAllProperties(obj) {
        let props = [];
        do {
            props = props.concat(Object.getOwnPropertyNames(obj));
            obj = Object.getPrototypeOf(obj);
        } while (obj);
        return props;
    }
    onMessageFromParent(m) {
        // A message was received from Parent
        let handle = this.instanceHandles[m.instanceId];
        if (!handle && m.cmd !== MessageType.INIT) {
            console.log(`Child process: Unknown instanceId: "${m.instanceId}"`);
            return; // fail silently?
        }
        if (!handle) {
            // create temporary handle:
            handle = {
                id: m.instanceId,
                cmdId: 0,
                queue: {},
                instance: {}
            };
        }
        try {
            const instance = handle.instance;
            if (m.cmd === MessageType.INIT) {
                const msg = m;
                this._config = m.config;
                let pModuleClass;
                // Load in the class:
                if (lib_1.isBrowser()) {
                    pModuleClass = new Promise((resolve, reject) => {
                        // @ts-ignore
                        let oReq = new XMLHttpRequest();
                        oReq.open('GET', msg.modulePath, true);
                        // oReq.responseType = 'blob'
                        oReq.onload = () => {
                            if (oReq.response) {
                                resolve(oReq.response);
                            }
                            else {
                                reject(Error(`Bad reply from ${msg.modulePath} in instance ${handle.id}`));
                            }
                        };
                        oReq.send();
                    })
                        .then((bodyString) => {
                        // This is a terrible hack, I'm ashamed of myself.
                        // Better solutions are very much appreciated.
                        // tslint:disable-next-line:no-var-keyword
                        var f = null;
                        let fcn = `
							f = function() {
								${bodyString}
								;
								return ${msg.className}
							}
						`;
                        // tslint:disable-next-line:no-eval
                        let moduleClass = eval(fcn)();
                        f = f;
                        if (!moduleClass) {
                            throw Error(`${msg.className} not found in ${msg.modulePath}`);
                        }
                        return moduleClass;
                    });
                }
                else {
                    pModuleClass = Promise.resolve(require(msg.modulePath))
                        .then((module) => {
                        return module[msg.className];
                    });
                }
                pModuleClass
                    .then((moduleClass) => {
                    if (m.classFunction) {
                        // In single thread mode.
                        // When classFunction is provided, use that instead of the imported js file.
                        return m.classFunction;
                    }
                    else {
                        return moduleClass;
                    }
                })
                    .then((moduleClass) => {
                    const handle = {
                        id: msg.instanceId,
                        cmdId: 0,
                        queue: {},
                        instance: null // Note: This is dangerous, but gets set right after.
                    };
                    const decodedArgs = this.decodeArgumentsFromParent(handle, msg.args);
                    handle.instance = ((...args) => {
                        return new moduleClass(...args);
                    }).apply(null, decodedArgs);
                    this.instanceHandles[handle.id] = handle;
                    const instance = handle.instance;
                    const allProps = this.getAllProperties(instance);
                    const props = [];
                    allProps.forEach((prop) => {
                        if ([
                            'constructor',
                            '__defineGetter__',
                            '__defineSetter__',
                            'hasOwnProperty',
                            '__lookupGetter__',
                            '__lookupSetter__',
                            'isPrototypeOf',
                            'propertyIsEnumerable',
                            'toString',
                            'valueOf',
                            '__proto__',
                            'toLocaleString'
                        ].indexOf(prop) !== -1)
                            return;
                        let descriptor = Object.getOwnPropertyDescriptor(instance, prop);
                        let inProto = 0;
                        let proto = instance.__proto__;
                        while (!descriptor) {
                            if (!proto)
                                break;
                            descriptor = Object.getOwnPropertyDescriptor(proto, prop);
                            inProto++;
                            proto = proto.__proto__;
                        }
                        if (!descriptor)
                            descriptor = {};
                        let descr = {
                            // configurable:	!!descriptor.configurable,
                            inProto: inProto,
                            enumerable: !!descriptor.enumerable,
                            writable: !!descriptor.writable,
                            get: !!descriptor.get,
                            set: !!descriptor.set,
                            readable: !!(!descriptor.get && !descriptor.get) // if no getter or setter, ie an ordinary property
                        };
                        if (typeof instance[prop] === 'function') {
                            props.push({
                                key: prop,
                                type: InitPropType.FUNCTION,
                                descriptor: descr
                            });
                        }
                        else {
                            props.push({
                                key: prop,
                                type: InitPropType.VALUE,
                                descriptor: descr
                            });
                        }
                    });
                    this.reply(handle, msg, props);
                })
                    .catch((e) => {
                    console.log('INIT error', e);
                });
                if (!m.config.disableMultithreading) {
                    this.startOrphanMonitoring();
                }
            }
            else if (m.cmd === MessageType.PING) {
                this._pingCount++;
                this.reply(handle, m, null);
            }
            else if (m.cmd === MessageType.REPLY) {
                const msg = m;
                let cb = handle.queue[msg.replyTo + ''];
                if (!cb)
                    throw Error(`cmdId "${msg.cmdId}" not found in instance ${m.instanceId}!`);
                if (msg.error) {
                    cb(msg.error);
                }
                else {
                    cb(null, msg.reply);
                }
                delete handle.queue[msg.replyTo + ''];
            }
            else if (m.cmd === MessageType.FUNCTION) {
                // A function has been called by parent
                let msg = m;
                const fixedArgs = this.decodeArgumentsFromParent(handle, msg.args);
                let p = (typeof instance[msg.fcn] === 'function' ?
                    instance[msg.fcn](...fixedArgs) :
                    instance[msg.fcn]); // in case instance[msg.fcn] does not exist, it will simply resolve to undefined on the consumer side
                Promise.resolve(p)
                    .then((result) => {
                    const encodedResult = this.encodeArgumentsToParent(instance, [result]);
                    this.reply(handle, msg, encodedResult[0]);
                })
                    .catch((err) => {
                    let errorResponse = (err.stack || err.toString()) + `\n executing function "${msg.fcn}" of instance "${m.instanceId}"`;
                    this.replyError(handle, msg, errorResponse);
                });
            }
            else if (m.cmd === MessageType.SET) {
                let msg = m;
                const fixedValue = this.decodeArgumentsFromParent(handle, [msg.value])[0];
                instance[msg.property] = fixedValue;
                this.reply(handle, msg, fixedValue);
            }
            else if (m.cmd === MessageType.KILL) {
                let msg = m;
                // kill off instance
                this.killInstance(handle);
                this.reply(handle, msg, null);
            }
            else if (m.cmd === MessageType.CALLBACK) {
                let msg = m;
                let callback = this.callbacks[msg.callbackId];
                if (callback) {
                    try {
                        Promise.resolve(callback(...msg.args))
                            .then((result) => {
                            const encodedResult = this.encodeArgumentsToParent(instance, [result]);
                            this.reply(handle, msg, encodedResult[0]);
                        })
                            .catch((err) => {
                            let errorResponse = (err.stack || err.toString()) + `\n executing callback of instance "${m.instanceId}"`;
                            this.replyError(handle, msg, errorResponse);
                        });
                    }
                    catch (err) {
                        let errorResponse = (err.stack || err.toString()) + `\n executing (outer) callback of instance "${m.instanceId}"`;
                        this.replyError(handle, msg, errorResponse);
                    }
                }
                else {
                    this.replyError(handle, msg, `Callback "${msg.callbackId}" not found on instance "${m.instanceId}"`);
                }
            }
        }
        catch (e) {
            if (m.cmdId) {
                this.replyError(handle, m, `Error: ${e.toString()} ${e.stack} on instance "${m.instanceId}"`);
            }
            else
                this.log('Error: ' + e.toString(), e.stack);
        }
    }
    startOrphanMonitoring() {
        // expect our parent process to PING us now every and then
        // otherwise we consider ourselves to be orphaned
        // then we should exit the process
        if (this._config) {
            const pingTime = Math.max(500, this._config.freezeLimit || exports.DEFAULT_CHILD_FREEZE_TIME);
            let missed = 0;
            let previousPingCount = 0;
            setInterval(() => {
                if (this._pingCount === previousPingCount) {
                    // no ping has been received since last time
                    missed++;
                }
                else {
                    missed = 0;
                }
                previousPingCount = this._pingCount;
                if (missed > 2) {
                    // We've missed too many pings
                    console.log(`Child missed ${missed} pings, exiting process!`);
                    setTimeout(() => {
                        process.exit(27);
                    }, 100);
                }
            }, pingTime);
        }
    }
}
exports.Worker = Worker;
let argumentsCallbackId = 0;
function encodeArguments(instance, callbacks, args, disabledMultithreading) {
    try {
        return args.map((arg, i) => {
            try {
                if (typeof arg === 'object' && arg === instance) {
                    return { type: ArgumentType.OBJECT, value: 'self' };
                }
                if (disabledMultithreading) {
                    // In single-threaded mode, we can send the arguments directly, without any conversion:
                    if (arg instanceof Buffer)
                        return { type: ArgumentType.BUFFER, original: arg, value: null };
                    if (typeof arg === 'object')
                        return { type: ArgumentType.OBJECT, original: arg, value: null };
                }
                if (arg instanceof Buffer)
                    return { type: ArgumentType.BUFFER, value: arg.toString('hex') };
                if (typeof arg === 'string')
                    return { type: ArgumentType.STRING, value: arg };
                if (typeof arg === 'number')
                    return { type: ArgumentType.NUMBER, value: arg };
                if (typeof arg === 'function') {
                    const callbackId = argumentsCallbackId++;
                    callbacks[callbackId + ''] = arg;
                    return { type: ArgumentType.FUNCTION, value: callbackId + '' };
                }
                if (arg === undefined)
                    return { type: ArgumentType.UNDEFINED, value: arg };
                if (arg === null)
                    return { type: ArgumentType.NULL, value: arg };
                if (typeof arg === 'object')
                    return { type: ArgumentType.OBJECT, value: arg };
                return { type: ArgumentType.OTHER, value: arg };
            }
            catch (e) {
                if (e.stack)
                    e.stack += '\nIn encodeArguments, argument ' + i;
                throw e;
            }
        });
    }
    catch (e) {
        if (e.stack)
            e.stack += '\nThreadedClass, unsupported attribute';
        throw e;
    }
}
exports.encodeArguments = encodeArguments;
function decodeArguments(instance, args, getCallback) {
    // Go through arguments and de-serialize them
    return args.map((a) => {
        if (a.original !== undefined)
            return a.original;
        if (a.type === ArgumentType.STRING)
            return a.value;
        if (a.type === ArgumentType.NUMBER)
            return a.value;
        if (a.type === ArgumentType.BUFFER)
            return Buffer.from(a.value, 'hex');
        if (a.type === ArgumentType.UNDEFINED)
            return a.value;
        if (a.type === ArgumentType.NULL)
            return a.value;
        if (a.type === ArgumentType.FUNCTION) {
            return getCallback(a);
        }
        if (a.type === ArgumentType.OBJECT) {
            if (a.value === 'self') {
                return instance();
            }
            else {
                return a.value;
            }
        }
        return a.value;
    });
}
exports.decodeArguments = decodeArguments;
//# sourceMappingURL=internalApi.js.map