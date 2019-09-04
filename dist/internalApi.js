"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var lib_1 = require("./lib");
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
var Worker = /** @class */ (function () {
    function Worker() {
        var _this = this;
        this.instanceHandles = {};
        this.callbacks = {};
        this.disabledMultithreading = false;
        this._pingCount = 0;
        this.log = function () {
            var data = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                data[_i] = arguments[_i];
            }
            _this.sendLog(data);
        };
        this.logError = function () {
            var data = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                data[_i] = arguments[_i];
            }
            _this.sendLog(['Error'].concat(data));
        };
    }
    Worker.prototype.decodeArgumentsFromParent = function (handle, args) {
        var _this = this;
        return decodeArguments(handle.instance, args, function (a) {
            return (function () {
                var args = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    args[_i] = arguments[_i];
                }
                return new Promise(function (resolve, reject) {
                    var callbackId = a.value;
                    _this.sendCallback(handle, callbackId, args, function (err, encodedResult) {
                        if (err) {
                            reject(err);
                        }
                        else {
                            var result = encodedResult ? _this.decodeArgumentsFromParent(handle, [encodedResult]) : [encodedResult];
                            resolve(result[0]);
                        }
                    });
                });
            });
        });
    };
    Worker.prototype.encodeArgumentsToParent = function (instance, args) {
        return encodeArguments(instance, this.callbacks, args, this.disabledMultithreading);
    };
    Worker.prototype.reply = function (handle, m, reply) {
        this.sendReplyToParent(handle, m.cmdId, undefined, reply);
    };
    Worker.prototype.replyError = function (handle, m, error) {
        this.sendReplyToParent(handle, m.cmdId, error);
    };
    Worker.prototype.sendReplyToParent = function (handle, replyTo, error, reply) {
        var msg = {
            cmd: MessageType.REPLY,
            replyTo: replyTo,
            error: error ? (error.stack || error).toString() : error,
            reply: reply
        };
        this.sendMessageToParent(handle, msg);
    };
    Worker.prototype.sendLog = function (log) {
        var msg = {
            cmd: MessageType.LOG,
            log: log
        };
        this.sendMessageToParent(null, msg);
    };
    Worker.prototype.sendCallback = function (handle, callbackId, args, cb) {
        var msg = {
            cmd: MessageType.CALLBACK,
            callbackId: callbackId,
            args: args
        };
        this.sendMessageToParent(handle, msg, cb);
    };
    Worker.prototype.getAllProperties = function (obj) {
        var props = [];
        do {
            props = props.concat(Object.getOwnPropertyNames(obj));
            obj = Object.getPrototypeOf(obj);
        } while (obj);
        return props;
    };
    Worker.prototype.onMessageFromParent = function (m) {
        var _this = this;
        // A message was received from Parent
        var handle = this.instanceHandles[m.instanceId];
        if (!handle && m.cmd !== MessageType.INIT) {
            console.log("Child process: Unknown instanceId: \"" + m.instanceId + "\"");
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
            var instance_1 = handle.instance;
            if (m.cmd === MessageType.INIT) {
                var msg_1 = m;
                this._config = m.config;
                var pModuleClass = void 0;
                // Load in the class:
                if (lib_1.isBrowser()) {
                    pModuleClass = new Promise(function (resolve, reject) {
                        // @ts-ignore
                        var oReq = new XMLHttpRequest();
                        oReq.open('GET', msg_1.modulePath, true);
                        // oReq.responseType = 'blob'
                        oReq.onload = function () {
                            if (oReq.response) {
                                resolve(oReq.response);
                            }
                            else {
                                reject(Error("Bad reply from " + msg_1.modulePath + " in instance " + handle.id));
                            }
                        };
                        oReq.send();
                    })
                        .then(function (bodyString) {
                        // This is a terrible hack, I'm ashamed of myself.
                        // Better solutions are very much appreciated.
                        // tslint:disable-next-line:no-var-keyword
                        var f = null;
                        var fcn = "\n\t\t\t\t\t\t\tf = function() {\n\t\t\t\t\t\t\t\t" + bodyString + "\n\t\t\t\t\t\t\t\t;\n\t\t\t\t\t\t\t\treturn " + msg_1.className + "\n\t\t\t\t\t\t\t}\n\t\t\t\t\t\t";
                        // tslint:disable-next-line:no-eval
                        var moduleClass = eval(fcn)();
                        f = f;
                        if (!moduleClass) {
                            throw Error(msg_1.className + " not found in " + msg_1.modulePath);
                        }
                        return moduleClass;
                    });
                }
                else {
                    pModuleClass = Promise.resolve(require(msg_1.modulePath))
                        .then(function (module) {
                        return module[msg_1.className];
                    });
                }
                pModuleClass
                    .then(function (moduleClass) {
                    if (m.classFunction) {
                        // In single thread mode.
                        // When classFunction is provided, use that instead of the imported js file.
                        return m.classFunction;
                    }
                    else {
                        return moduleClass;
                    }
                })
                    .then(function (moduleClass) {
                    var handle = {
                        id: msg_1.instanceId,
                        cmdId: 0,
                        queue: {},
                        instance: (function () {
                            var args = [];
                            for (var _i = 0; _i < arguments.length; _i++) {
                                args[_i] = arguments[_i];
                            }
                            return new (moduleClass.bind.apply(moduleClass, [void 0].concat(args)))();
                        }).apply(null, msg_1.args)
                    };
                    _this.instanceHandles[handle.id] = handle;
                    var instance = handle.instance;
                    var allProps = _this.getAllProperties(instance);
                    var props = [];
                    allProps.forEach(function (prop) {
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
                        var descriptor = Object.getOwnPropertyDescriptor(instance, prop);
                        var inProto = 0;
                        var proto = instance.__proto__;
                        while (!descriptor) {
                            if (!proto)
                                break;
                            descriptor = Object.getOwnPropertyDescriptor(proto, prop);
                            inProto++;
                            proto = proto.__proto__;
                        }
                        if (!descriptor)
                            descriptor = {};
                        var descr = {
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
                    _this.reply(handle, msg_1, props);
                })
                    .catch(function (e) {
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
                var msg = m;
                var cb = handle.queue[msg.replyTo + ''];
                if (!cb)
                    throw Error("cmdId \"" + msg.cmdId + "\" not found in instance " + m.instanceId + "!");
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
                var msg_2 = m;
                var fixedArgs = this.decodeArgumentsFromParent(handle, msg_2.args);
                var p = (typeof instance_1[msg_2.fcn] === 'function' ? instance_1[msg_2.fcn].apply(instance_1, fixedArgs) :
                    instance_1[msg_2.fcn]); // in case instance[msg.fcn] does not exist, it will simply resolve to undefined on the consumer side
                Promise.resolve(p)
                    .then(function (result) {
                    var encodedResult = _this.encodeArgumentsToParent(instance_1, [result]);
                    _this.reply(handle, msg_2, encodedResult[0]);
                })
                    .catch(function (err) {
                    var errorResponse = (err.stack || err.toString()) + ("\n executing function \"" + msg_2.fcn + "\" of instance \"" + m.instanceId + "\"");
                    _this.replyError(handle, msg_2, errorResponse);
                });
            }
            else if (m.cmd === MessageType.SET) {
                var msg = m;
                var fixedValue = this.decodeArgumentsFromParent(handle, [msg.value])[0];
                instance_1[msg.property] = fixedValue;
                this.reply(handle, msg, fixedValue);
            }
            else if (m.cmd === MessageType.KILL) {
                var msg = m;
                // kill off instance
                this.killInstance(handle);
                this.reply(handle, msg, null);
            }
            else if (m.cmd === MessageType.CALLBACK) {
                var msg_3 = m;
                var callback = this.callbacks[msg_3.callbackId];
                if (callback) {
                    try {
                        Promise.resolve(callback.apply(void 0, msg_3.args))
                            .then(function (result) {
                            var encodedResult = _this.encodeArgumentsToParent(instance_1, [result]);
                            _this.reply(handle, msg_3, encodedResult[0]);
                        })
                            .catch(function (err) {
                            var errorResponse = (err.stack || err.toString()) + ("\n executing callback of instance \"" + m.instanceId + "\"");
                            _this.replyError(handle, msg_3, errorResponse);
                        });
                    }
                    catch (err) {
                        var errorResponse = (err.stack || err.toString()) + ("\n executing (outer) callback of instance \"" + m.instanceId + "\"");
                        this.replyError(handle, msg_3, errorResponse);
                    }
                }
                else {
                    this.replyError(handle, msg_3, "Callback \"" + msg_3.callbackId + "\" not found on instance \"" + m.instanceId + "\"");
                }
            }
        }
        catch (e) {
            if (m.cmdId) {
                this.replyError(handle, m, "Error: " + e.toString() + " " + e.stack + " on instance \"" + m.instanceId + "\"");
            }
            else
                this.log('Error: ' + e.toString(), e.stack);
        }
    };
    Worker.prototype.startOrphanMonitoring = function () {
        // expect our parent process to PING us now every and then
        // otherwise we consider ourselves to be orphaned
        // then we should exit the process
        var _this = this;
        if (this._config) {
            var pingTime = Math.max(500, this._config.freezeLimit || exports.DEFAULT_CHILD_FREEZE_TIME);
            var missed_1 = 0;
            var previousPingCount_1 = 0;
            setInterval(function () {
                if (_this._pingCount === previousPingCount_1) {
                    // no ping has been received since last time
                    missed_1++;
                }
                else {
                    missed_1 = 0;
                }
                previousPingCount_1 = _this._pingCount;
                if (missed_1 > 2) {
                    // We've missed too many pings
                    console.log("Child missed " + missed_1 + " pings, exiting process!");
                    setTimeout(function () {
                        process.exit(27);
                    }, 100);
                }
            }, pingTime);
        }
    };
    return Worker;
}());
exports.Worker = Worker;
var argumentsCallbackId = 0;
function encodeArguments(instance, callbacks, args, disabledMultithreading) {
    try {
        return args.map(function (arg, i) {
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
                    var callbackId = argumentsCallbackId++;
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
    return args.map(function (a) {
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
                return instance;
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