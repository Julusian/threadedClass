(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.ThreadedClass = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
var events_1 = require("events");
var internalApi_1 = require("./internalApi");
var FakeWorker = /** @class */ (function (_super) {
    tslib_1.__extends(FakeWorker, _super);
    function FakeWorker(cb) {
        var _this = _super.call(this) || this;
        _this.disabledMultithreading = true;
        _this.mockProcessSend = cb;
        return _this;
    }
    FakeWorker.prototype.killInstance = function () {
        // throw new Error('Trying to kill a non threaded process!')
    };
    FakeWorker.prototype.sendMessageToParent = function (handle, msg, cb) {
        if (msg.cmd === internalApi_1.MessageType.LOG) {
            var message = tslib_1.__assign({}, msg, {
                cmdId: 0,
                instanceId: ''
            });
            // Send message to Parent:
            this.mockProcessSend(message);
        }
        else {
            var message = tslib_1.__assign({}, msg, {
                cmdId: handle.cmdId++,
                instanceId: handle.id
            });
            if (cb)
                handle.queue[message.cmdId + ''] = cb;
            // Send message to Parent:
            this.mockProcessSend(message);
        }
    };
    return FakeWorker;
}(internalApi_1.Worker));
exports.FakeWorker = FakeWorker;
var FakeProcess = /** @class */ (function (_super) {
    tslib_1.__extends(FakeProcess, _super);
    function FakeProcess() {
        var _this = _super.call(this) || this;
        _this.killed = false;
        _this.pid = 0;
        _this.connected = true;
        _this.worker = new FakeWorker(function (m) {
            _this.emit('message', m);
        });
        return _this;
    }
    FakeProcess.prototype.kill = function () {
        // @todo: needs some implementation.
        this.emit('close');
        // throw new Error('Function kill in FakeProcess is not implemented.')
    };
    FakeProcess.prototype.send = function (m) {
        this.worker.onMessageFromParent(m);
        return true;
    };
    FakeProcess.prototype.disconnect = function () {
        throw new Error('Function disconnect in FakeProcess is not implemented.');
    };
    FakeProcess.prototype.unref = function () {
        throw new Error('Function unref in FakeProcess is not implemented.');
    };
    FakeProcess.prototype.ref = function () {
        throw new Error('Function ref in FakeProcess is not implemented.');
    };
    return FakeProcess;
}(events_1.EventEmitter));
exports.FakeProcess = FakeProcess;

},{"./internalApi":3,"events":13,"tslib":17}],2:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
var manager_1 = require("./manager");
exports.ThreadedClassManager = manager_1.ThreadedClassManager;
tslib_1.__exportStar(require("./threadedClass"), exports);

},{"./manager":5,"./threadedClass":6,"tslib":17}],3:[function(require,module,exports){
(function (process,Buffer){
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
                                reject(Error('Bad reply from ' + msg_1.modulePath));
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
                    throw Error('cmdId "' + msg.cmdId + '" not found!');
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
                    _this.replyError(handle, msg_2, err);
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
                            _this.replyError(handle, msg_3, err);
                        });
                    }
                    catch (err) {
                        this.replyError(handle, msg_3, err);
                    }
                }
                else {
                    this.replyError(handle, msg_3, 'callback "' + msg_3.callbackId + '" not found');
                }
            }
        }
        catch (e) {
            if (m.cmdId)
                this.replyError(handle, m, 'Error: ' + e.toString() + e.stack);
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

}).call(this,require('_process'),require("buffer").Buffer)

},{"./lib":4,"_process":16,"buffer":11}],4:[function(require,module,exports){
(function (process){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Returns true if running in th browser (if not, then we're in NodeJS)
 */
function isBrowser() {
    return !(process && process.hasOwnProperty('stdin'));
}
exports.isBrowser = isBrowser;
function browserSupportsWebWorkers() {
    // @ts-ignore
    return !!(isBrowser() && window.Worker);
}
exports.browserSupportsWebWorkers = browserSupportsWebWorkers;
function nodeSupportsWorkerThreads() {
    var workerThreads = getWorkerThreads();
    return !!workerThreads;
}
exports.nodeSupportsWorkerThreads = nodeSupportsWorkerThreads;
function getWorkerThreads() {
    try {
        var workerThreads = require('worker_threads');
        return workerThreads;
    }
    catch (e) {
        return null;
    }
}
exports.getWorkerThreads = getWorkerThreads;

}).call(this,require('_process'))

},{"_process":16,"worker_threads":undefined}],5:[function(require,module,exports){
(function (process){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
var child_process_1 = require("child_process");
var fakeProcess_1 = require("./fakeProcess");
var internalApi_1 = require("./internalApi");
var events_1 = require("events");
var lib_1 = require("./lib");
var webWorkers_1 = require("./webWorkers");
var workerThreads_1 = require("./workerThreads");
var ThreadedClassManagerClass = /** @class */ (function () {
    function ThreadedClassManagerClass(internal) {
        this._internal = internal;
    }
    /** Destroy a proxy class */
    ThreadedClassManagerClass.prototype.destroy = function (proxy) {
        return this._internal.killProxy(proxy);
    };
    ThreadedClassManagerClass.prototype.destroyAll = function () {
        return this._internal.killAllChildren();
    };
    ThreadedClassManagerClass.prototype.getThreadCount = function () {
        return this._internal.getChildrenCount();
    };
    ThreadedClassManagerClass.prototype.onEvent = function (proxy, event, cb) {
        this._internal.on(event, function (child) {
            var foundChild = Object.keys(child.instances).find(function (instanceId) {
                var instance = child.instances[instanceId];
                return instance.proxy === proxy;
            });
            if (foundChild) {
                cb();
            }
        });
    };
    /**
     * Restart the thread of the proxy instance
     * @param proxy
     * @param forceRestart If true, will kill the thread and restart it
     */
    ThreadedClassManagerClass.prototype.restart = function (proxy, forceRestart) {
        return this._internal.restart(proxy, forceRestart);
    };
    /**
     * Returns a description of what threading mode the library will use in the current context.
     */
    ThreadedClassManagerClass.prototype.getThreadMode = function () {
        if (lib_1.isBrowser()) {
            if (lib_1.browserSupportsWebWorkers()) {
                return ThreadMode.WEB_WORKER;
            }
            else {
                return ThreadMode.NOT_SUPPORTED;
            }
        }
        else {
            if (lib_1.nodeSupportsWorkerThreads()) {
                return ThreadMode.WORKER_THREADS;
            }
            else {
                return ThreadMode.CHILD_PROCESS;
            }
        }
    };
    return ThreadedClassManagerClass;
}());
exports.ThreadedClassManagerClass = ThreadedClassManagerClass;
var ThreadedClassManagerClassInternal = /** @class */ (function (_super) {
    tslib_1.__extends(ThreadedClassManagerClassInternal, _super);
    function ThreadedClassManagerClassInternal() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        /** Set to true if you want to handle the exiting of child process yourselt */
        _this.dontHandleExit = false;
        _this.isInitialized = false;
        _this._threadId = 0;
        _this._instanceId = 0;
        _this._methodId = 0;
        _this._children = {};
        _this._pinging = true; // for testing only
        return _this;
    }
    ThreadedClassManagerClassInternal.prototype.getChild = function (config, pathToWorker) {
        this._init();
        var child = null;
        if (config.threadId) {
            child = this._children[config.threadId] || null;
        }
        else if (config.threadUsage) {
            child = this._findFreeChild(config.threadUsage);
        }
        if (!child) {
            // Create new child process:
            var newChild = {
                id: config.threadId || ('process_' + this._threadId++),
                isNamed: !!config.threadId,
                pathToWorker: pathToWorker,
                process: this._createFork(config, pathToWorker),
                usage: config.threadUsage || 1,
                instances: {},
                methods: {},
                alive: true,
                isClosing: false,
                config: config,
                cmdId: 0,
                queue: {},
                callbackId: 0,
                callbacks: {}
            };
            this._setupChildProcess(newChild);
            this._children[newChild.id] = newChild;
            child = newChild;
        }
        return child;
    };
    /**
     * Attach a proxy-instance to a child
     * @param child
     * @param proxy
     * @param onMessage
     */
    ThreadedClassManagerClassInternal.prototype.attachInstance = function (config, child, proxy, pathToModule, className, classFunction, constructorArgs, onMessage) {
        var instance = {
            id: 'instance_' + this._instanceId++,
            child: child,
            proxy: proxy,
            usage: config.threadUsage,
            freezeLimit: config.freezeLimit,
            onMessageCallback: onMessage,
            pathToModule: pathToModule,
            className: className,
            classFunction: classFunction,
            constructorArgs: constructorArgs,
            initialized: false,
            config: config
        };
        child.instances[instance.id] = instance;
        return instance;
    };
    ThreadedClassManagerClassInternal.prototype.killProxy = function (proxy) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var foundProxy = false;
            Object.keys(_this._children).find(function (childId) {
                var child = _this._children[childId];
                var instanceId = Object.keys(child.instances).find(function (instanceId) {
                    var instance = child.instances[instanceId];
                    return (instance.proxy === proxy);
                });
                if (instanceId) {
                    var instance_1 = child.instances[instanceId];
                    foundProxy = true;
                    if (Object.keys(child.instances).length === 1) {
                        // if there is only one instance left, we can kill the child
                        _this.killChild(childId)
                            .then(resolve)
                            .catch(reject);
                    }
                    else {
                        var cleanup_1 = function () {
                            delete instance_1.child;
                            delete child.instances[instanceId];
                        };
                        _this.sendMessageToChild(instance_1, {
                            cmd: internalApi_1.MessageType.KILL
                        }, function () {
                            cleanup_1();
                            resolve();
                        });
                        setTimeout(function () {
                            cleanup_1();
                            reject('Timeout: Kill child instance');
                        }, 1000);
                        if (instance_1.usage) {
                            child.usage -= instance_1.usage;
                        }
                    }
                    return true;
                }
                return false;
            });
            if (!foundProxy) {
                reject('Proxy not found');
            }
        });
    };
    ThreadedClassManagerClassInternal.prototype.sendMessageToChild = function (instance, messageConstr, cb) {
        try {
            if (!instance.child)
                throw new Error('Instance has been detached from child process');
            if (!instance.child.alive)
                throw new Error('Child process has been closed');
            if (instance.child.isClosing)
                throw new Error('Child process is closing');
            var message_1 = tslib_1.__assign({}, messageConstr, {
                cmdId: instance.child.cmdId++,
                instanceId: instance.id
            });
            if (message_1.cmd !== internalApi_1.MessageType.INIT &&
                !instance.initialized)
                throw Error('Child instance is not initialized');
            if (cb)
                instance.child.queue[message_1.cmdId + ''] = cb;
            try {
                instance.child.process.send(message_1, function (error) {
                    if (error) {
                        if (instance.child.queue[message_1.cmdId + '']) {
                            instance.child.queue[message_1.cmdId + ''](instance, new Error('Error sending message to child process: ' + error));
                            delete instance.child.queue[message_1.cmdId + ''];
                        }
                    }
                });
            }
            catch (e) {
                if ((e.toString() || '').match(/circular structure/)) { // TypeError: Converting circular structure to JSON
                    throw new Error('Unsupported attribute (circular structure): ' + e.toString());
                }
                else {
                    throw e;
                }
            }
        }
        catch (e) {
            if (cb)
                cb(instance, (e.stack || e).toString());
            else
                throw e;
        }
    };
    ThreadedClassManagerClassInternal.prototype.getChildrenCount = function () {
        return Object.keys(this._children).length;
    };
    ThreadedClassManagerClassInternal.prototype.killAllChildren = function () {
        var _this = this;
        return Promise.all(Object.keys(this._children).map(function (id) {
            return _this.killChild(id);
        })).then(function () {
            return;
        });
    };
    ThreadedClassManagerClassInternal.prototype.restart = function (proxy, forceRestart) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var foundInstance, foundChild;
            var _this = this;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        Object.keys(this._children).find(function (childId) {
                            var child = _this._children[childId];
                            var found = Object.keys(child.instances).find(function (instanceId) {
                                var instance = child.instances[instanceId];
                                if (instance.proxy === proxy) {
                                    foundInstance = instance;
                                    return true;
                                }
                                return false;
                            });
                            if (found) {
                                foundChild = child;
                                return true;
                            }
                            return false;
                        });
                        if (!foundChild)
                            throw Error('Child not found');
                        if (!foundInstance)
                            throw Error('Instance not found');
                        return [4 /*yield*/, this.restartChild(foundChild, [foundInstance], forceRestart)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    ThreadedClassManagerClassInternal.prototype.restartChild = function (child, onlyInstances, forceRestart) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var p, promises, instances;
            var _this = this;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(child.alive && forceRestart)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.killChild(child, true)];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        if (!child.alive) {
                            // clear old process:
                            child.process.removeAllListeners();
                            delete child.process;
                            Object.keys(child.instances).forEach(function (instanceId) {
                                var instance = child.instances[instanceId];
                                instance.initialized = false;
                            });
                            // start new process
                            child.alive = true;
                            child.isClosing = false;
                            child.process = this._createFork(child.config, child.pathToWorker);
                            this._setupChildProcess(child);
                        }
                        p = new Promise(function (resolve, reject) {
                            var onInit = function (child) {
                                if (child === child) {
                                    resolve();
                                    _this.removeListener('initialized', onInit);
                                }
                            };
                            _this.on('initialized', onInit);
                            setTimeout(function () {
                                reject('Timeout when trying to restart');
                                _this.removeListener('initialized', onInit);
                            }, 1000);
                        });
                        promises = [];
                        instances = (onlyInstances ||
                            Object.keys(child.instances).map(function (instanceId) {
                                return child.instances[instanceId];
                            }));
                        instances.forEach(function (instance) {
                            promises.push(new Promise(function (resolve, reject) {
                                _this.sendInit(child, instance, instance.config, function (_instance, err) {
                                    // no need to do anything, the proxy is already initialized from earlier
                                    if (err) {
                                        reject(err);
                                    }
                                    else {
                                        resolve();
                                    }
                                    return true;
                                });
                            }));
                        });
                        return [4 /*yield*/, Promise.all(promises)];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, p];
                    case 4:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    ThreadedClassManagerClassInternal.prototype.sendInit = function (child, instance, config, cb) {
        var _this = this;
        var msg = {
            cmd: internalApi_1.MessageType.INIT,
            modulePath: instance.pathToModule,
            className: instance.className,
            classFunction: (config.disableMultithreading ? instance.classFunction : undefined),
            args: instance.constructorArgs,
            config: config
        };
        instance.initialized = true;
        exports.ThreadedClassManagerInternal.sendMessageToChild(instance, msg, function (instance, e, initProps) {
            if (!cb ||
                cb(instance, e, initProps)) {
                _this.emit('initialized', child);
            }
        });
    };
    ThreadedClassManagerClassInternal.prototype.startMonitoringChild = function (instance) {
        var _this = this;
        var pingTime = instance.freezeLimit || internalApi_1.DEFAULT_CHILD_FREEZE_TIME;
        var monitorChild = function () {
            if (instance.child && instance.child.alive && _this._pinging) {
                _this._pingChild(instance)
                    .then(function () {
                    // ping successful
                    // ping again later:
                    setTimeout(function () {
                        monitorChild();
                    }, pingTime);
                })
                    .catch(function () {
                    // Ping failed
                    if (instance.child &&
                        instance.child.alive &&
                        !instance.child.isClosing) {
                        // console.log(`Ping failed for Child "${instance.child.id }" of instance "${instance.id}"`)
                        _this._childHasCrashed(instance.child, 'Child process ping timeout');
                    }
                });
            }
        };
        setTimeout(function () {
            monitorChild();
        }, pingTime);
    };
    ThreadedClassManagerClassInternal.prototype.doMethod = function (child, cb) {
        // Return a promise that will execute the callback cb
        // but also put the promise in child.methods, so that the promise can be aborted
        // in the case of a child crash
        var methodId = 'm' + this._methodId++;
        var p = new Promise(function (resolve, reject) {
            child.methods[methodId] = { resolve: resolve, reject: reject };
            cb(resolve, reject);
        })
            .then(function (result) {
            delete child.methods[methodId];
            return result;
        })
            .catch(function (error) {
            delete child.methods[methodId];
            throw error;
        });
        return p;
    };
    /** Called before using internally */
    ThreadedClassManagerClassInternal.prototype._init = function () {
        var _this = this;
        if (!this.isInitialized &&
            !this.dontHandleExit) {
            if (!lib_1.isBrowser()) { // in NodeJS
                // Close the child processes upon exit:
                process.stdin.resume(); // so the program will not close instantly
                var exitHandler = function (options, err) {
                    _this.killAllChildren()
                        .catch(console.log);
                    if (err)
                        console.log(err.stack);
                    if (options.exit)
                        process.exit();
                };
                // do something when app is closing
                process.on('exit', exitHandler.bind(null, { cleanup: true }));
                // catches ctrl+c event
                process.on('SIGINT', exitHandler.bind(null, { exit: true }));
                // catches "kill pid" (for example: nodemon restart)
                process.on('SIGUSR1', exitHandler.bind(null, { exit: true }));
                process.on('SIGUSR2', exitHandler.bind(null, { exit: true }));
                // catches uncaught exceptions
                process.on('uncaughtException', exitHandler.bind(null, { exit: true }));
            }
        }
        this.isInitialized = true;
    };
    ThreadedClassManagerClassInternal.prototype._pingChild = function (instance) {
        return new Promise(function (resolve, reject) {
            var msg = {
                cmd: internalApi_1.MessageType.PING
            };
            exports.ThreadedClassManagerInternal.sendMessageToChild(instance, msg, function (_instance, err) {
                if (!err) {
                    resolve();
                }
                else {
                    console.log('error', err);
                    reject();
                }
            });
            setTimeout(function () {
                reject(); // timeout
            }, instance.freezeLimit || internalApi_1.DEFAULT_CHILD_FREEZE_TIME);
        });
    };
    ThreadedClassManagerClassInternal.prototype._childHasCrashed = function (child, reason) {
        // Called whenever a fatal error with a child has been discovered
        var _this = this;
        this.rejectChildMethods(child, reason);
        if (!child.isClosing) {
            var shouldRestart_1 = false;
            var restartInstances_1 = [];
            Object.keys(child.instances).forEach(function (instanceId) {
                var instance = child.instances[instanceId];
                if (instance.config.autoRestart) {
                    shouldRestart_1 = true;
                    restartInstances_1.push(instance);
                }
            });
            if (shouldRestart_1) {
                this.restartChild(child, restartInstances_1, true)
                    .then(function () {
                    _this.emit('restarted', child);
                })
                    .catch(function (err) { return console.log('Error when running restartChild()', err); });
            }
            else {
                // No instance wants to be restarted, make sure the child is killed then:
                if (child.alive) {
                    this.killChild(child, true)
                        .catch(function (err) { return console.log('Error when running killChild()', err); });
                }
            }
        }
    };
    ThreadedClassManagerClassInternal.prototype._createFork = function (config, pathToWorker) {
        if (config.disableMultithreading) {
            return new fakeProcess_1.FakeProcess();
        }
        else {
            if (lib_1.isBrowser()) {
                return webWorkers_1.forkWebWorker(pathToWorker);
            }
            else {
                // in NodeJS
                if (lib_1.nodeSupportsWorkerThreads()) {
                    return workerThreads_1.forkWorkerThread(pathToWorker);
                }
                else {
                    return child_process_1.fork(pathToWorker);
                }
            }
        }
    };
    ThreadedClassManagerClassInternal.prototype._setupChildProcess = function (child) {
        var _this = this;
        child.process.on('close', function (_code) {
            if (child.alive) {
                child.alive = false;
                _this.emit('thread_closed', child);
                _this._childHasCrashed(child, 'Child process closed');
            }
        });
        child.process.on('error', function (err) {
            console.log('Error from ' + child.id, err);
        });
        child.process.on('message', function (message) {
            if (message.cmd === internalApi_1.MessageType.LOG) {
                console.log.apply(console, message.log);
            }
            else {
                var instance = child.instances[message.instanceId];
                if (instance) {
                    try {
                        instance.onMessageCallback(instance, message);
                    }
                    catch (e) {
                        console.log('Error in onMessageCallback', message, instance);
                        console.log(e);
                        throw e;
                    }
                }
                else {
                    console.log("Instance \"" + message.instanceId + "\" not found");
                }
            }
        });
    };
    ThreadedClassManagerClassInternal.prototype._findFreeChild = function (threadUsage) {
        var _this = this;
        var id = Object.keys(this._children).find(function (id) {
            var child = _this._children[id];
            if (!child.isNamed &&
                child.usage + threadUsage <= 1) {
                return true;
            }
            return false;
        });
        if (id) {
            var child = this._children[id];
            child.usage += threadUsage;
            return child;
        }
        return null;
    };
    ThreadedClassManagerClassInternal.prototype.killChild = function (idOrChild, dontCleanUp) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var child;
            if (typeof idOrChild === 'string') {
                var id = idOrChild;
                child = _this._children[id];
                if (!child) {
                    reject("killChild: Child " + id + " not found");
                    return;
                }
            }
            else {
                child = idOrChild;
            }
            if (child) {
                if (!child.alive) {
                    delete _this._children[child.id];
                    resolve();
                }
                else {
                    child.process.once('close', function () {
                        if (!dontCleanUp) {
                            // Clean up:
                            Object.keys(child.instances).forEach(function (instanceId) {
                                var instance = child.instances[instanceId];
                                delete instance.child;
                                delete child.instances[instanceId];
                            });
                            delete _this._children[child.id];
                        }
                        resolve();
                    });
                    setTimeout(function () {
                        delete _this._children[child.id];
                        reject('Timeout: Kill child process');
                    }, 1000);
                    if (!child.isClosing) {
                        child.isClosing = true;
                        child.process.kill();
                    }
                }
            }
        });
    };
    ThreadedClassManagerClassInternal.prototype.rejectChildMethods = function (child, reason) {
        Object.keys(child.methods).forEach(function (methodId) {
            var method = child.methods[methodId];
            method.reject(Error('Method aborted due to: ' + reason));
        });
        child.methods = {};
    };
    return ThreadedClassManagerClassInternal;
}(events_1.EventEmitter));
exports.ThreadedClassManagerClassInternal = ThreadedClassManagerClassInternal;
var ThreadMode;
(function (ThreadMode) {
    /** Web-workers, in browser */
    ThreadMode["WEB_WORKER"] = "web_worker";
    /** Nothing, Web-workers not supported */
    ThreadMode["NOT_SUPPORTED"] = "not_supported";
    /** Worker threads */
    ThreadMode["WORKER_THREADS"] = "worker_threads";
    /** Child process */
    ThreadMode["CHILD_PROCESS"] = "child_process";
})(ThreadMode = exports.ThreadMode || (exports.ThreadMode = {}));
// Singleton:
exports.ThreadedClassManagerInternal = new ThreadedClassManagerClassInternal();
exports.ThreadedClassManager = new ThreadedClassManagerClass(exports.ThreadedClassManagerInternal);

}).call(this,require('_process'))

},{"./fakeProcess":1,"./internalApi":3,"./lib":4,"./webWorkers":7,"./workerThreads":8,"_process":16,"child_process":10,"events":13,"tslib":17}],6:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var path = require("path");
var callsites = require("callsites");
var internalApi_1 = require("./internalApi");
var manager_1 = require("./manager");
var lib_1 = require("./lib");
/**
 * Returns an asynchronous version of the provided class
 * @param orgModule Path to imported module (this is what is in the require('XX') function, or import {class} from 'XX'} )
 * @param orgClass The class to be threaded
 * @param constructorArgs An array of arguments to be fed into the class constructor
 */
function threadedClass(orgModule, orgClass, constructorArgs, config) {
    if (config === void 0) { config = {}; }
    // @ts-ignore expression is allways false
    // if (typeof orgClass !== 'function') throw Error('argument 2 must be a class!')
    var orgClassName = orgClass.name;
    if (lib_1.isBrowser()) {
        if (!config.pathToWorker) {
            throw Error('config.pathToWorker is required in brower');
        }
        if (!lib_1.browserSupportsWebWorkers()) {
            console.log('Web-workers not supported, disabling multi-threading');
            config.disableMultithreading = true;
        }
    }
    var parentCallPath = callsites()[1].getFileName();
    var thisCallPath = callsites()[0].getFileName();
    return new Promise(function (resolve, reject) {
        function sendFcn(instance, fcn, args, cb) {
            var msg = {
                cmd: internalApi_1.MessageType.FUNCTION,
                fcn: fcn,
                args: args
            };
            manager_1.ThreadedClassManagerInternal.sendMessageToChild(instance, msg, cb);
        }
        function sendSet(instance, property, value, cb) {
            var msg = {
                cmd: internalApi_1.MessageType.SET,
                property: property,
                value: value
            };
            manager_1.ThreadedClassManagerInternal.sendMessageToChild(instance, msg, cb);
        }
        function sendReply(instance, replyTo, error, reply, cb) {
            var msg = {
                cmd: internalApi_1.MessageType.REPLY,
                replyTo: replyTo,
                reply: reply,
                error: error ? (error.stack || error).toString() : error
            };
            manager_1.ThreadedClassManagerInternal.sendMessageToChild(instance, msg, cb);
        }
        function replyError(instance, msg, error) {
            sendReply(instance, msg.cmdId, error);
        }
        function sendCallback(instance, callbackId, args, cb) {
            var msg = {
                cmd: internalApi_1.MessageType.CALLBACK,
                callbackId: callbackId,
                args: args
            };
            manager_1.ThreadedClassManagerInternal.sendMessageToChild(instance, msg, cb);
        }
        function decodeResultFromWorker(instance, encodedResult) {
            return internalApi_1.decodeArguments(instance.proxy, [encodedResult], function (a) {
                return function () {
                    var args = [];
                    for (var _i = 0; _i < arguments.length; _i++) {
                        args[_i] = arguments[_i];
                    }
                    return new Promise(function (resolve, reject) {
                        // Function result function is called from parent
                        sendCallback(instance, a.value, args, function (_instance, err, encodedResult) {
                            // Function result is returned from worker
                            if (err) {
                                reject(err);
                            }
                            else {
                                var result = decodeResultFromWorker(_instance, encodedResult);
                                resolve(result);
                            }
                        });
                    });
                };
            })[0];
        }
        function onMessage(instance, m) {
            if (m.cmd === internalApi_1.MessageType.REPLY) {
                var msg = m;
                var child = instance.child;
                var cb = child.queue[msg.replyTo + ''];
                if (!cb)
                    return;
                if (msg.error) {
                    cb(instance, msg.error);
                }
                else {
                    cb(instance, null, msg.reply);
                }
                delete child.queue[msg.replyTo + ''];
            }
            else if (m.cmd === internalApi_1.MessageType.CALLBACK) {
                // Callback function is called by worker
                var msg_1 = m;
                var callback = instance.child.callbacks[msg_1.callbackId];
                if (callback) {
                    try {
                        Promise.resolve(callback.apply(void 0, msg_1.args))
                            .then(function (result) {
                            var encodedResult = internalApi_1.encodeArguments(instance, instance.child.callbacks, [result], !!config.disableMultithreading);
                            sendReply(instance, msg_1.cmdId, undefined, encodedResult[0]);
                        })
                            .catch(function (err) {
                            replyError(instance, msg_1, err);
                        });
                    }
                    catch (err) {
                        replyError(instance, msg_1, err);
                    }
                }
                else
                    throw Error('callback "' + msg_1.callbackId + '" not found');
            }
        }
        try {
            var pathToModule = '';
            var pathToWorker = '';
            if (lib_1.isBrowser()) {
                pathToWorker = config.pathToWorker;
                pathToModule = orgModule;
            }
            else {
                if (!parentCallPath)
                    throw new Error('Unable to resolve parent file path');
                if (!thisCallPath)
                    throw new Error('Unable to resolve own file path');
                var absPathToModule = (orgModule.match(/^\./) ?
                    path.resolve(parentCallPath, '../', orgModule) :
                    orgModule);
                pathToModule = require.resolve(absPathToModule);
                pathToWorker = thisCallPath
                    .replace(/threadedClass(\.[tj]s)$/, 'threadedclass-worker.js')
                    .replace(/src([\\\/])threadedclass-worker/, 'dist$1threadedclass-worker');
            }
            var child = manager_1.ThreadedClassManagerInternal.getChild(config, pathToWorker);
            var proxy_1 = {};
            var instanceInChild_1 = manager_1.ThreadedClassManagerInternal.attachInstance(config, child, proxy_1, pathToModule, orgClassName, orgClass, constructorArgs, onMessage);
            manager_1.ThreadedClassManagerInternal.sendInit(child, instanceInChild_1, config, function (instance, err, props) {
                // This callback is called from the worker process, with a list of supported properties of the c
                if (err) {
                    reject(err);
                    return false;
                }
                else {
                    props.forEach(function (p) {
                        if (!instance.child.alive)
                            throw Error('Child process has been closed');
                        if (proxy_1.hasOwnProperty(p.key)) {
                            return;
                        }
                        if (p.type === internalApi_1.InitPropType.FUNCTION) {
                            var fcn = function () {
                                // An instance method is called by parent
                                var args = [];
                                for (var _i = 0; _i < arguments.length; _i++) {
                                    args[_i] = arguments[_i];
                                }
                                if (!instance.child)
                                    return Promise.reject(new Error('Instance has been detached from child process'));
                                return manager_1.ThreadedClassManagerInternal.doMethod(instance.child, function (resolve, reject) {
                                    if (!instance.child)
                                        throw new Error('Instance has been detached from child process');
                                    // Go through arguments and serialize them:
                                    var encodedArgs = internalApi_1.encodeArguments(instance, instance.child.callbacks, args, !!config.disableMultithreading);
                                    sendFcn(instance, p.key, encodedArgs, function (_instance, err, encodedResult) {
                                        // Function result is returned from worker
                                        if (err) {
                                            reject(err);
                                        }
                                        else {
                                            var result = decodeResultFromWorker(_instance, encodedResult);
                                            resolve(result);
                                        }
                                    });
                                });
                            };
                            // @ts-ignore
                            proxy_1[p.key] = fcn;
                        }
                        else if (p.type === internalApi_1.InitPropType.VALUE) {
                            var m = {
                                configurable: false,
                                enumerable: p.descriptor.enumerable
                                // writable: // We handle everything through getters & setters instead
                            };
                            if (p.descriptor.get ||
                                p.descriptor.readable) {
                                m.get = function () {
                                    return new Promise(function (resolve, reject) {
                                        sendFcn(instance, p.key, [], function (_instance, err, encodedResult) {
                                            if (err) {
                                                reject(err);
                                            }
                                            else {
                                                var result = decodeResultFromWorker(_instance, encodedResult);
                                                resolve(result);
                                            }
                                        });
                                    });
                                };
                            }
                            if (p.descriptor.set ||
                                p.descriptor.writable) {
                                m.set = function (newVal) {
                                    var fixedArgs = internalApi_1.encodeArguments(instance, instance.child.callbacks, [newVal], !!config.disableMultithreading);
                                    // in the strictest of worlds, we should block the main thread here,
                                    // until the remote acknowledges the write.
                                    // Instead we're going to pretend that everything is okay. *whistling*
                                    sendSet(instance, p.key, fixedArgs[0], function (_instance, err, _result) {
                                        if (err) {
                                            console.log('Error in setter', err);
                                        }
                                    });
                                };
                            }
                            Object.defineProperty(proxy_1, p.key, m);
                        }
                    });
                    manager_1.ThreadedClassManagerInternal.startMonitoringChild(instanceInChild_1);
                    resolve(proxy_1);
                    return true;
                }
            });
        }
        catch (e) {
            reject(e);
        }
    });
}
exports.threadedClass = threadedClass;

},{"./internalApi":3,"./lib":4,"./manager":5,"callsites":12,"path":15}],7:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
var events_1 = require("events");
/** Functions for emulating child-process in web-workers */
function forkWebWorker(pathToWorker) {
    return new WebWorkerProcess(pathToWorker);
}
exports.forkWebWorker = forkWebWorker;
var WebWorkerProcess = /** @class */ (function (_super) {
    tslib_1.__extends(WebWorkerProcess, _super);
    function WebWorkerProcess(pathToWorker) {
        var _this = _super.call(this) || this;
        _this.killed = false;
        _this.pid = 0;
        _this.connected = true;
        try {
            // @ts-ignore
            _this.worker = new window.Worker(pathToWorker);
            _this.worker.onmessage = function (message) {
                if (message.type === 'message') {
                    _this.emit('message', message.data);
                }
                else
                    console.log('unknown message type', message);
            };
            _this.worker.onmessageerror = function (error) {
                console.error('ww message error', error);
            };
            _this.worker.onerror = function (error) {
                console.error('ww error', error);
            };
        }
        catch (error) {
            var str = (error.stack || error).toString() + '';
            if (str.match(/cannot be accessed from origin/) &&
                str.match(/file:\/\//)) {
                throw Error('Unable to create Web-Worker. Not allowed to run from local file system.\n' + str);
            }
            else {
                throw error;
            }
        }
        return _this;
        // this.worker.postMessage([first.value,second.value]); // Sending message as an array to the worker
    }
    WebWorkerProcess.prototype.kill = function () {
        this.worker.terminate();
        this.emit('close');
        // throw new Error('Function kill in WebWorker is not implemented.')
    };
    WebWorkerProcess.prototype.send = function (message) {
        this.worker.postMessage(message);
        // this.worker.onMessageFromParent(m)
        return true;
    };
    WebWorkerProcess.prototype.disconnect = function () {
        throw new Error('Function disconnect in WebWorker is not implemented.');
    };
    WebWorkerProcess.prototype.unref = function () {
        throw new Error('Function unref in WebWorker is not implemented.');
    };
    WebWorkerProcess.prototype.ref = function () {
        throw new Error('Function ref in WebWorker is not implemented.');
    };
    return WebWorkerProcess;
}(events_1.EventEmitter));
exports.WebWorkerProcess = WebWorkerProcess;

},{"events":13,"tslib":17}],8:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
var events_1 = require("events");
var lib_1 = require("./lib");
var WorkerThreads = lib_1.getWorkerThreads();
var Worker = WorkerThreads ? WorkerThreads.Worker : undefined;
/** Functions for spawning worker-threads in NodeJS */
function forkWorkerThread(pathToWorker) {
    return new WorkerThread(pathToWorker);
}
exports.forkWorkerThread = forkWorkerThread;
var WorkerThread = /** @class */ (function (_super) {
    tslib_1.__extends(WorkerThread, _super);
    function WorkerThread(pathToWorker) {
        var _this = _super.call(this) || this;
        _this.killed = false;
        _this.pid = 0;
        _this.connected = true;
        // @ts-ignore
        // this.worker = new window.Worker(pathToWorker)
        if (!Worker)
            throw new Error('Unable to create Worker thread! Not supported!');
        _this.worker = new Worker(pathToWorker, {
            workerData: ''
        });
        _this.worker.on('message', function (message) {
            _this.emit('message', message);
            // if (message.type === 'message') {
            // } else console.log('unknown message type', message)
        });
        _this.worker.on('error', function (error) {
            console.error('Worker Thread error', error);
        });
        _this.worker.on('exit', function (_code) {
            _this.emit('close');
        });
        _this.worker.on('close', function () {
            _this.emit('close');
        });
        return _this;
    }
    WorkerThread.prototype.kill = function () {
        var _this = this;
        this.worker.terminate(function () {
            _this.emit('close');
        });
        // throw new Error('Function kill in Worker Threads is not implemented.')
    };
    WorkerThread.prototype.send = function (message) {
        this.worker.postMessage(message);
        // this.worker.onMessageFromParent(m)
        return true;
    };
    WorkerThread.prototype.disconnect = function () {
        throw new Error('Function disconnect in Worker Threads is not implemented.');
    };
    WorkerThread.prototype.unref = function () {
        throw new Error('Function unref in Worker Threads is not implemented.');
    };
    WorkerThread.prototype.ref = function () {
        throw new Error('Function ref in Worker Threads is not implemented.');
    };
    return WorkerThread;
}(events_1.EventEmitter));
exports.WorkerThread = WorkerThread;

},{"./lib":4,"events":13,"tslib":17}],9:[function(require,module,exports){
'use strict'

exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

// Support decoding URL-safe base64 strings, as Node.js does.
// See: https://en.wikipedia.org/wiki/Base64#URL_applications
revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function getLens (b64) {
  var len = b64.length

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // Trim off extra bytes after placeholder bytes are found
  // See: https://github.com/beatgammit/base64-js/issues/42
  var validLen = b64.indexOf('=')
  if (validLen === -1) validLen = len

  var placeHoldersLen = validLen === len
    ? 0
    : 4 - (validLen % 4)

  return [validLen, placeHoldersLen]
}

// base64 is 4/3 + up to two characters of the original data
function byteLength (b64) {
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function _byteLength (b64, validLen, placeHoldersLen) {
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function toByteArray (b64) {
  var tmp
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]

  var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen))

  var curByte = 0

  // if there are placeholders, only get up to the last complete 4 chars
  var len = placeHoldersLen > 0
    ? validLen - 4
    : validLen

  var i
  for (i = 0; i < len; i += 4) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 18) |
      (revLookup[b64.charCodeAt(i + 1)] << 12) |
      (revLookup[b64.charCodeAt(i + 2)] << 6) |
      revLookup[b64.charCodeAt(i + 3)]
    arr[curByte++] = (tmp >> 16) & 0xFF
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 2) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 2) |
      (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 1) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 10) |
      (revLookup[b64.charCodeAt(i + 1)] << 4) |
      (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] +
    lookup[num >> 12 & 0x3F] +
    lookup[num >> 6 & 0x3F] +
    lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp =
      ((uint8[i] << 16) & 0xFF0000) +
      ((uint8[i + 1] << 8) & 0xFF00) +
      (uint8[i + 2] & 0xFF)
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(
      uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)
    ))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    parts.push(
      lookup[tmp >> 2] +
      lookup[(tmp << 4) & 0x3F] +
      '=='
    )
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + uint8[len - 1]
    parts.push(
      lookup[tmp >> 10] +
      lookup[(tmp >> 4) & 0x3F] +
      lookup[(tmp << 2) & 0x3F] +
      '='
    )
  }

  return parts.join('')
}

},{}],10:[function(require,module,exports){

},{}],11:[function(require,module,exports){
(function (Buffer){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var customInspectSymbol = typeof Symbol === 'function' ? Symbol.for('nodejs.util.inspect.custom') : null

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

var K_MAX_LENGTH = 0x7fffffff
exports.kMaxLength = K_MAX_LENGTH

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Print warning and recommend using `buffer` v4.x which has an Object
 *               implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * We report that the browser does not support typed arrays if the are not subclassable
 * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
 * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
 * for __proto__ and has a buggy typed array implementation.
 */
Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport()

if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== 'undefined' &&
    typeof console.error === 'function') {
  console.error(
    'This browser lacks typed array (Uint8Array) support which is required by ' +
    '`buffer` v5.x. Use `buffer` v4.x if you require old browser support.'
  )
}

function typedArraySupport () {
  // Can typed array instances can be augmented?
  try {
    var arr = new Uint8Array(1)
    var proto = { foo: function () { return 42 } }
    Object.setPrototypeOf(proto, Uint8Array.prototype)
    Object.setPrototypeOf(arr, proto)
    return arr.foo() === 42
  } catch (e) {
    return false
  }
}

Object.defineProperty(Buffer.prototype, 'parent', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.buffer
  }
})

Object.defineProperty(Buffer.prototype, 'offset', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.byteOffset
  }
})

function createBuffer (length) {
  if (length > K_MAX_LENGTH) {
    throw new RangeError('The value "' + length + '" is invalid for option "size"')
  }
  // Return an augmented `Uint8Array` instance
  var buf = new Uint8Array(length)
  Object.setPrototypeOf(buf, Buffer.prototype)
  return buf
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new TypeError(
        'The "string" argument must be of type string. Received type number'
      )
    }
    return allocUnsafe(arg)
  }
  return from(arg, encodingOrOffset, length)
}

// Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
if (typeof Symbol !== 'undefined' && Symbol.species != null &&
    Buffer[Symbol.species] === Buffer) {
  Object.defineProperty(Buffer, Symbol.species, {
    value: null,
    configurable: true,
    enumerable: false,
    writable: false
  })
}

Buffer.poolSize = 8192 // not used by this implementation

function from (value, encodingOrOffset, length) {
  if (typeof value === 'string') {
    return fromString(value, encodingOrOffset)
  }

  if (ArrayBuffer.isView(value)) {
    return fromArrayLike(value)
  }

  if (value == null) {
    throw new TypeError(
      'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
      'or Array-like Object. Received type ' + (typeof value)
    )
  }

  if (isInstance(value, ArrayBuffer) ||
      (value && isInstance(value.buffer, ArrayBuffer))) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (typeof value === 'number') {
    throw new TypeError(
      'The "value" argument must not be of type number. Received type number'
    )
  }

  var valueOf = value.valueOf && value.valueOf()
  if (valueOf != null && valueOf !== value) {
    return Buffer.from(valueOf, encodingOrOffset, length)
  }

  var b = fromObject(value)
  if (b) return b

  if (typeof Symbol !== 'undefined' && Symbol.toPrimitive != null &&
      typeof value[Symbol.toPrimitive] === 'function') {
    return Buffer.from(
      value[Symbol.toPrimitive]('string'), encodingOrOffset, length
    )
  }

  throw new TypeError(
    'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
    'or Array-like Object. Received type ' + (typeof value)
  )
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(value, encodingOrOffset, length)
}

// Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
// https://github.com/feross/buffer/pull/148
Object.setPrototypeOf(Buffer.prototype, Uint8Array.prototype)
Object.setPrototypeOf(Buffer, Uint8Array)

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be of type number')
  } else if (size < 0) {
    throw new RangeError('The value "' + size + '" is invalid for option "size"')
  }
}

function alloc (size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(size).fill(fill, encoding)
      : createBuffer(size).fill(fill)
  }
  return createBuffer(size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(size, fill, encoding)
}

function allocUnsafe (size) {
  assertSize(size)
  return createBuffer(size < 0 ? 0 : checked(size) | 0)
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(size)
}

function fromString (string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('Unknown encoding: ' + encoding)
  }

  var length = byteLength(string, encoding) | 0
  var buf = createBuffer(length)

  var actual = buf.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    buf = buf.slice(0, actual)
  }

  return buf
}

function fromArrayLike (array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  var buf = createBuffer(length)
  for (var i = 0; i < length; i += 1) {
    buf[i] = array[i] & 255
  }
  return buf
}

function fromArrayBuffer (array, byteOffset, length) {
  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('"offset" is outside of buffer bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('"length" is outside of buffer bounds')
  }

  var buf
  if (byteOffset === undefined && length === undefined) {
    buf = new Uint8Array(array)
  } else if (length === undefined) {
    buf = new Uint8Array(array, byteOffset)
  } else {
    buf = new Uint8Array(array, byteOffset, length)
  }

  // Return an augmented `Uint8Array` instance
  Object.setPrototypeOf(buf, Buffer.prototype)

  return buf
}

function fromObject (obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    var buf = createBuffer(len)

    if (buf.length === 0) {
      return buf
    }

    obj.copy(buf, 0, 0, len)
    return buf
  }

  if (obj.length !== undefined) {
    if (typeof obj.length !== 'number' || numberIsNaN(obj.length)) {
      return createBuffer(0)
    }
    return fromArrayLike(obj)
  }

  if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
    return fromArrayLike(obj.data)
  }
}

function checked (length) {
  // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= K_MAX_LENGTH) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return b != null && b._isBuffer === true &&
    b !== Buffer.prototype // so Buffer.isBuffer(Buffer.prototype) will be false
}

Buffer.compare = function compare (a, b) {
  if (isInstance(a, Uint8Array)) a = Buffer.from(a, a.offset, a.byteLength)
  if (isInstance(b, Uint8Array)) b = Buffer.from(b, b.offset, b.byteLength)
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError(
      'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
    )
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!Array.isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (isInstance(buf, Uint8Array)) {
      buf = Buffer.from(buf)
    }
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    throw new TypeError(
      'The "string" argument must be one of type string, Buffer, or ArrayBuffer. ' +
      'Received type ' + typeof string
    )
  }

  var len = string.length
  var mustMatch = (arguments.length > 2 && arguments[2] === true)
  if (!mustMatch && len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) {
          return mustMatch ? -1 : utf8ToBytes(string).length // assume utf8
        }
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// This property is used by `Buffer.isBuffer` (and the `is-buffer` npm package)
// to detect a Buffer instance. It's not possible to use `instanceof Buffer`
// reliably in a browserify context because there could be multiple different
// copies of the 'buffer' package in use. This method works even for Buffer
// instances that were created from another copy of the `buffer` package.
// See: https://github.com/feross/buffer/issues/154
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.toLocaleString = Buffer.prototype.toString

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  str = this.toString('hex', 0, max).replace(/(.{2})/g, '$1 ').trim()
  if (this.length > max) str += ' ... '
  return '<Buffer ' + str + '>'
}
if (customInspectSymbol) {
  Buffer.prototype[customInspectSymbol] = Buffer.prototype.inspect
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (isInstance(target, Uint8Array)) {
    target = Buffer.from(target, target.offset, target.byteLength)
  }
  if (!Buffer.isBuffer(target)) {
    throw new TypeError(
      'The "target" argument must be one of type Buffer or Uint8Array. ' +
      'Received type ' + (typeof target)
    )
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset // Coerce to Number.
  if (numberIsNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [val], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i
  if (dir) {
    var foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      var found = true
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  var strLen = string.length

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (numberIsNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset >>> 0
    if (isFinite(length)) {
      length = length >>> 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
        : (firstByte > 0xBF) ? 2
          : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + (bytes[i + 1] * 256))
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf = this.subarray(start, end)
  // Return an augmented `Uint8Array` instance
  Object.setPrototypeOf(newBuf, Buffer.prototype)

  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset + 3] = (value >>> 24)
  this[offset + 2] = (value >>> 16)
  this[offset + 1] = (value >>> 8)
  this[offset] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  this[offset + 2] = (value >>> 16)
  this[offset + 3] = (value >>> 24)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!Buffer.isBuffer(target)) throw new TypeError('argument should be a Buffer')
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('Index out of range')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start

  if (this === target && typeof Uint8Array.prototype.copyWithin === 'function') {
    // Use built-in when available, missing from IE11
    this.copyWithin(targetStart, start, end)
  } else if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (var i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, end),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if ((encoding === 'utf8' && code < 128) ||
          encoding === 'latin1') {
        // Fast path: If `val` fits into a single byte, use that numeric value.
        val = code
      }
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : Buffer.from(val, encoding)
    var len = bytes.length
    if (len === 0) {
      throw new TypeError('The value "' + val +
        '" is invalid for argument "value"')
    }
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node takes equal signs as end of the Base64 encoding
  str = str.split('=')[0]
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = str.trim().replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

// ArrayBuffer or Uint8Array objects from other contexts (i.e. iframes) do not pass
// the `instanceof` check but they should be treated as of that type.
// See: https://github.com/feross/buffer/issues/166
function isInstance (obj, type) {
  return obj instanceof type ||
    (obj != null && obj.constructor != null && obj.constructor.name != null &&
      obj.constructor.name === type.name)
}
function numberIsNaN (obj) {
  // For IE11 support
  return obj !== obj // eslint-disable-line no-self-compare
}

}).call(this,require("buffer").Buffer)

},{"base64-js":9,"buffer":11,"ieee754":14}],12:[function(require,module,exports){
'use strict';

const callsites = () => {
	const _prepareStackTrace = Error.prepareStackTrace;
	Error.prepareStackTrace = (_, stack) => stack;
	const stack = new Error().stack.slice(1);
	Error.prepareStackTrace = _prepareStackTrace;
	return stack;
};

module.exports = callsites;
// TODO: Remove this for the next major release
module.exports.default = callsites;

},{}],13:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var objectCreate = Object.create || objectCreatePolyfill
var objectKeys = Object.keys || objectKeysPolyfill
var bind = Function.prototype.bind || functionBindPolyfill

function EventEmitter() {
  if (!this._events || !Object.prototype.hasOwnProperty.call(this, '_events')) {
    this._events = objectCreate(null);
    this._eventsCount = 0;
  }

  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
var defaultMaxListeners = 10;

var hasDefineProperty;
try {
  var o = {};
  if (Object.defineProperty) Object.defineProperty(o, 'x', { value: 0 });
  hasDefineProperty = o.x === 0;
} catch (err) { hasDefineProperty = false }
if (hasDefineProperty) {
  Object.defineProperty(EventEmitter, 'defaultMaxListeners', {
    enumerable: true,
    get: function() {
      return defaultMaxListeners;
    },
    set: function(arg) {
      // check whether the input is a positive number (whose value is zero or
      // greater and not a NaN).
      if (typeof arg !== 'number' || arg < 0 || arg !== arg)
        throw new TypeError('"defaultMaxListeners" must be a positive number');
      defaultMaxListeners = arg;
    }
  });
} else {
  EventEmitter.defaultMaxListeners = defaultMaxListeners;
}

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
  if (typeof n !== 'number' || n < 0 || isNaN(n))
    throw new TypeError('"n" argument must be a positive number');
  this._maxListeners = n;
  return this;
};

function $getMaxListeners(that) {
  if (that._maxListeners === undefined)
    return EventEmitter.defaultMaxListeners;
  return that._maxListeners;
}

EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
  return $getMaxListeners(this);
};

// These standalone emit* functions are used to optimize calling of event
// handlers for fast cases because emit() itself often has a variable number of
// arguments and can be deoptimized because of that. These functions always have
// the same number of arguments and thus do not get deoptimized, so the code
// inside them can execute faster.
function emitNone(handler, isFn, self) {
  if (isFn)
    handler.call(self);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self);
  }
}
function emitOne(handler, isFn, self, arg1) {
  if (isFn)
    handler.call(self, arg1);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1);
  }
}
function emitTwo(handler, isFn, self, arg1, arg2) {
  if (isFn)
    handler.call(self, arg1, arg2);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2);
  }
}
function emitThree(handler, isFn, self, arg1, arg2, arg3) {
  if (isFn)
    handler.call(self, arg1, arg2, arg3);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2, arg3);
  }
}

function emitMany(handler, isFn, self, args) {
  if (isFn)
    handler.apply(self, args);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].apply(self, args);
  }
}

EventEmitter.prototype.emit = function emit(type) {
  var er, handler, len, args, i, events;
  var doError = (type === 'error');

  events = this._events;
  if (events)
    doError = (doError && events.error == null);
  else if (!doError)
    return false;

  // If there is no 'error' event listener then throw.
  if (doError) {
    if (arguments.length > 1)
      er = arguments[1];
    if (er instanceof Error) {
      throw er; // Unhandled 'error' event
    } else {
      // At least give some kind of context to the user
      var err = new Error('Unhandled "error" event. (' + er + ')');
      err.context = er;
      throw err;
    }
    return false;
  }

  handler = events[type];

  if (!handler)
    return false;

  var isFn = typeof handler === 'function';
  len = arguments.length;
  switch (len) {
      // fast cases
    case 1:
      emitNone(handler, isFn, this);
      break;
    case 2:
      emitOne(handler, isFn, this, arguments[1]);
      break;
    case 3:
      emitTwo(handler, isFn, this, arguments[1], arguments[2]);
      break;
    case 4:
      emitThree(handler, isFn, this, arguments[1], arguments[2], arguments[3]);
      break;
      // slower
    default:
      args = new Array(len - 1);
      for (i = 1; i < len; i++)
        args[i - 1] = arguments[i];
      emitMany(handler, isFn, this, args);
  }

  return true;
};

function _addListener(target, type, listener, prepend) {
  var m;
  var events;
  var existing;

  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');

  events = target._events;
  if (!events) {
    events = target._events = objectCreate(null);
    target._eventsCount = 0;
  } else {
    // To avoid recursion in the case that type === "newListener"! Before
    // adding it to the listeners, first emit "newListener".
    if (events.newListener) {
      target.emit('newListener', type,
          listener.listener ? listener.listener : listener);

      // Re-assign `events` because a newListener handler could have caused the
      // this._events to be assigned to a new object
      events = target._events;
    }
    existing = events[type];
  }

  if (!existing) {
    // Optimize the case of one listener. Don't need the extra array object.
    existing = events[type] = listener;
    ++target._eventsCount;
  } else {
    if (typeof existing === 'function') {
      // Adding the second element, need to change to array.
      existing = events[type] =
          prepend ? [listener, existing] : [existing, listener];
    } else {
      // If we've already got an array, just append.
      if (prepend) {
        existing.unshift(listener);
      } else {
        existing.push(listener);
      }
    }

    // Check for listener leak
    if (!existing.warned) {
      m = $getMaxListeners(target);
      if (m && m > 0 && existing.length > m) {
        existing.warned = true;
        var w = new Error('Possible EventEmitter memory leak detected. ' +
            existing.length + ' "' + String(type) + '" listeners ' +
            'added. Use emitter.setMaxListeners() to ' +
            'increase limit.');
        w.name = 'MaxListenersExceededWarning';
        w.emitter = target;
        w.type = type;
        w.count = existing.length;
        if (typeof console === 'object' && console.warn) {
          console.warn('%s: %s', w.name, w.message);
        }
      }
    }
  }

  return target;
}

EventEmitter.prototype.addListener = function addListener(type, listener) {
  return _addListener(this, type, listener, false);
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.prependListener =
    function prependListener(type, listener) {
      return _addListener(this, type, listener, true);
    };

function onceWrapper() {
  if (!this.fired) {
    this.target.removeListener(this.type, this.wrapFn);
    this.fired = true;
    switch (arguments.length) {
      case 0:
        return this.listener.call(this.target);
      case 1:
        return this.listener.call(this.target, arguments[0]);
      case 2:
        return this.listener.call(this.target, arguments[0], arguments[1]);
      case 3:
        return this.listener.call(this.target, arguments[0], arguments[1],
            arguments[2]);
      default:
        var args = new Array(arguments.length);
        for (var i = 0; i < args.length; ++i)
          args[i] = arguments[i];
        this.listener.apply(this.target, args);
    }
  }
}

function _onceWrap(target, type, listener) {
  var state = { fired: false, wrapFn: undefined, target: target, type: type, listener: listener };
  var wrapped = bind.call(onceWrapper, state);
  wrapped.listener = listener;
  state.wrapFn = wrapped;
  return wrapped;
}

EventEmitter.prototype.once = function once(type, listener) {
  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');
  this.on(type, _onceWrap(this, type, listener));
  return this;
};

EventEmitter.prototype.prependOnceListener =
    function prependOnceListener(type, listener) {
      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');
      this.prependListener(type, _onceWrap(this, type, listener));
      return this;
    };

// Emits a 'removeListener' event if and only if the listener was removed.
EventEmitter.prototype.removeListener =
    function removeListener(type, listener) {
      var list, events, position, i, originalListener;

      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');

      events = this._events;
      if (!events)
        return this;

      list = events[type];
      if (!list)
        return this;

      if (list === listener || list.listener === listener) {
        if (--this._eventsCount === 0)
          this._events = objectCreate(null);
        else {
          delete events[type];
          if (events.removeListener)
            this.emit('removeListener', type, list.listener || listener);
        }
      } else if (typeof list !== 'function') {
        position = -1;

        for (i = list.length - 1; i >= 0; i--) {
          if (list[i] === listener || list[i].listener === listener) {
            originalListener = list[i].listener;
            position = i;
            break;
          }
        }

        if (position < 0)
          return this;

        if (position === 0)
          list.shift();
        else
          spliceOne(list, position);

        if (list.length === 1)
          events[type] = list[0];

        if (events.removeListener)
          this.emit('removeListener', type, originalListener || listener);
      }

      return this;
    };

EventEmitter.prototype.removeAllListeners =
    function removeAllListeners(type) {
      var listeners, events, i;

      events = this._events;
      if (!events)
        return this;

      // not listening for removeListener, no need to emit
      if (!events.removeListener) {
        if (arguments.length === 0) {
          this._events = objectCreate(null);
          this._eventsCount = 0;
        } else if (events[type]) {
          if (--this._eventsCount === 0)
            this._events = objectCreate(null);
          else
            delete events[type];
        }
        return this;
      }

      // emit removeListener for all listeners on all events
      if (arguments.length === 0) {
        var keys = objectKeys(events);
        var key;
        for (i = 0; i < keys.length; ++i) {
          key = keys[i];
          if (key === 'removeListener') continue;
          this.removeAllListeners(key);
        }
        this.removeAllListeners('removeListener');
        this._events = objectCreate(null);
        this._eventsCount = 0;
        return this;
      }

      listeners = events[type];

      if (typeof listeners === 'function') {
        this.removeListener(type, listeners);
      } else if (listeners) {
        // LIFO order
        for (i = listeners.length - 1; i >= 0; i--) {
          this.removeListener(type, listeners[i]);
        }
      }

      return this;
    };

function _listeners(target, type, unwrap) {
  var events = target._events;

  if (!events)
    return [];

  var evlistener = events[type];
  if (!evlistener)
    return [];

  if (typeof evlistener === 'function')
    return unwrap ? [evlistener.listener || evlistener] : [evlistener];

  return unwrap ? unwrapListeners(evlistener) : arrayClone(evlistener, evlistener.length);
}

EventEmitter.prototype.listeners = function listeners(type) {
  return _listeners(this, type, true);
};

EventEmitter.prototype.rawListeners = function rawListeners(type) {
  return _listeners(this, type, false);
};

EventEmitter.listenerCount = function(emitter, type) {
  if (typeof emitter.listenerCount === 'function') {
    return emitter.listenerCount(type);
  } else {
    return listenerCount.call(emitter, type);
  }
};

EventEmitter.prototype.listenerCount = listenerCount;
function listenerCount(type) {
  var events = this._events;

  if (events) {
    var evlistener = events[type];

    if (typeof evlistener === 'function') {
      return 1;
    } else if (evlistener) {
      return evlistener.length;
    }
  }

  return 0;
}

EventEmitter.prototype.eventNames = function eventNames() {
  return this._eventsCount > 0 ? Reflect.ownKeys(this._events) : [];
};

// About 1.5x faster than the two-arg version of Array#splice().
function spliceOne(list, index) {
  for (var i = index, k = i + 1, n = list.length; k < n; i += 1, k += 1)
    list[i] = list[k];
  list.pop();
}

function arrayClone(arr, n) {
  var copy = new Array(n);
  for (var i = 0; i < n; ++i)
    copy[i] = arr[i];
  return copy;
}

function unwrapListeners(arr) {
  var ret = new Array(arr.length);
  for (var i = 0; i < ret.length; ++i) {
    ret[i] = arr[i].listener || arr[i];
  }
  return ret;
}

function objectCreatePolyfill(proto) {
  var F = function() {};
  F.prototype = proto;
  return new F;
}
function objectKeysPolyfill(obj) {
  var keys = [];
  for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) {
    keys.push(k);
  }
  return k;
}
function functionBindPolyfill(context) {
  var fn = this;
  return function () {
    return fn.apply(context, arguments);
  };
}

},{}],14:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = (e * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = (m * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = ((value * c) - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],15:[function(require,module,exports){
(function (process){
// .dirname, .basename, and .extname methods are extracted from Node.js v8.11.1,
// backported and transplited with Babel, with backwards-compat fixes

// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function (path) {
  if (typeof path !== 'string') path = path + '';
  if (path.length === 0) return '.';
  var code = path.charCodeAt(0);
  var hasRoot = code === 47 /*/*/;
  var end = -1;
  var matchedSlash = true;
  for (var i = path.length - 1; i >= 1; --i) {
    code = path.charCodeAt(i);
    if (code === 47 /*/*/) {
        if (!matchedSlash) {
          end = i;
          break;
        }
      } else {
      // We saw the first non-path separator
      matchedSlash = false;
    }
  }

  if (end === -1) return hasRoot ? '/' : '.';
  if (hasRoot && end === 1) {
    // return '//';
    // Backwards-compat fix:
    return '/';
  }
  return path.slice(0, end);
};

function basename(path) {
  if (typeof path !== 'string') path = path + '';

  var start = 0;
  var end = -1;
  var matchedSlash = true;
  var i;

  for (i = path.length - 1; i >= 0; --i) {
    if (path.charCodeAt(i) === 47 /*/*/) {
        // If we reached a path separator that was not part of a set of path
        // separators at the end of the string, stop now
        if (!matchedSlash) {
          start = i + 1;
          break;
        }
      } else if (end === -1) {
      // We saw the first non-path separator, mark this as the end of our
      // path component
      matchedSlash = false;
      end = i + 1;
    }
  }

  if (end === -1) return '';
  return path.slice(start, end);
}

// Uses a mixed approach for backwards-compatibility, as ext behavior changed
// in new Node.js versions, so only basename() above is backported here
exports.basename = function (path, ext) {
  var f = basename(path);
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};

exports.extname = function (path) {
  if (typeof path !== 'string') path = path + '';
  var startDot = -1;
  var startPart = 0;
  var end = -1;
  var matchedSlash = true;
  // Track the state of characters (if any) we see before our first dot and
  // after any path separator we find
  var preDotState = 0;
  for (var i = path.length - 1; i >= 0; --i) {
    var code = path.charCodeAt(i);
    if (code === 47 /*/*/) {
        // If we reached a path separator that was not part of a set of path
        // separators at the end of the string, stop now
        if (!matchedSlash) {
          startPart = i + 1;
          break;
        }
        continue;
      }
    if (end === -1) {
      // We saw the first non-path separator, mark this as the end of our
      // extension
      matchedSlash = false;
      end = i + 1;
    }
    if (code === 46 /*.*/) {
        // If this is our first dot, mark it as the start of our extension
        if (startDot === -1)
          startDot = i;
        else if (preDotState !== 1)
          preDotState = 1;
    } else if (startDot !== -1) {
      // We saw a non-dot and non-path separator before our dot, so we should
      // have a good chance at having a non-empty extension
      preDotState = -1;
    }
  }

  if (startDot === -1 || end === -1 ||
      // We saw a non-dot character immediately before the dot
      preDotState === 0 ||
      // The (right-most) trimmed path component is exactly '..'
      preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
    return '';
  }
  return path.slice(startDot, end);
};

function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b'
    ? function (str, start, len) { return str.substr(start, len) }
    : function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

}).call(this,require('_process'))

},{"_process":16}],16:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],17:[function(require,module,exports){
(function (global){
/*! *****************************************************************************
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */
/* global global, define, System, Reflect, Promise */
var __extends;
var __assign;
var __rest;
var __decorate;
var __param;
var __metadata;
var __awaiter;
var __generator;
var __exportStar;
var __values;
var __read;
var __spread;
var __spreadArrays;
var __await;
var __asyncGenerator;
var __asyncDelegator;
var __asyncValues;
var __makeTemplateObject;
var __importStar;
var __importDefault;
(function (factory) {
    var root = typeof global === "object" ? global : typeof self === "object" ? self : typeof this === "object" ? this : {};
    if (typeof define === "function" && define.amd) {
        define("tslib", ["exports"], function (exports) { factory(createExporter(root, createExporter(exports))); });
    }
    else if (typeof module === "object" && typeof module.exports === "object") {
        factory(createExporter(root, createExporter(module.exports)));
    }
    else {
        factory(createExporter(root));
    }
    function createExporter(exports, previous) {
        if (exports !== root) {
            if (typeof Object.create === "function") {
                Object.defineProperty(exports, "__esModule", { value: true });
            }
            else {
                exports.__esModule = true;
            }
        }
        return function (id, v) { return exports[id] = previous ? previous(id, v) : v; };
    }
})
(function (exporter) {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };

    __extends = function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };

    __assign = Object.assign || function (t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
    };

    __rest = function (s, e) {
        var t = {};
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
            t[p] = s[p];
        if (s != null && typeof Object.getOwnPropertySymbols === "function")
            for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
                if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                    t[p[i]] = s[p[i]];
            }
        return t;
    };

    __decorate = function (decorators, target, key, desc) {
        var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
        if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
        else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
        return c > 3 && r && Object.defineProperty(target, key, r), r;
    };

    __param = function (paramIndex, decorator) {
        return function (target, key) { decorator(target, key, paramIndex); }
    };

    __metadata = function (metadataKey, metadataValue) {
        if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(metadataKey, metadataValue);
    };

    __awaiter = function (thisArg, _arguments, P, generator) {
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    };

    __generator = function (thisArg, body) {
        var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
        return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
        function verb(n) { return function (v) { return step([n, v]); }; }
        function step(op) {
            if (f) throw new TypeError("Generator is already executing.");
            while (_) try {
                if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
                if (y = 0, t) op = [op[0] & 2, t.value];
                switch (op[0]) {
                    case 0: case 1: t = op; break;
                    case 4: _.label++; return { value: op[1], done: false };
                    case 5: _.label++; y = op[1]; op = [0]; continue;
                    case 7: op = _.ops.pop(); _.trys.pop(); continue;
                    default:
                        if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                        if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                        if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                        if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                        if (t[2]) _.ops.pop();
                        _.trys.pop(); continue;
                }
                op = body.call(thisArg, _);
            } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
            if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
        }
    };

    __exportStar = function (m, exports) {
        for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
    };

    __values = function (o) {
        var m = typeof Symbol === "function" && o[Symbol.iterator], i = 0;
        if (m) return m.call(o);
        return {
            next: function () {
                if (o && i >= o.length) o = void 0;
                return { value: o && o[i++], done: !o };
            }
        };
    };

    __read = function (o, n) {
        var m = typeof Symbol === "function" && o[Symbol.iterator];
        if (!m) return o;
        var i = m.call(o), r, ar = [], e;
        try {
            while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
        }
        catch (error) { e = { error: error }; }
        finally {
            try {
                if (r && !r.done && (m = i["return"])) m.call(i);
            }
            finally { if (e) throw e.error; }
        }
        return ar;
    };

    __spread = function () {
        for (var ar = [], i = 0; i < arguments.length; i++)
            ar = ar.concat(__read(arguments[i]));
        return ar;
    };

    __spreadArrays = function () {
        for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
        for (var r = Array(s), k = 0, i = 0; i < il; i++)
            for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
                r[k] = a[j];
        return r;
    };

    __await = function (v) {
        return this instanceof __await ? (this.v = v, this) : new __await(v);
    };

    __asyncGenerator = function (thisArg, _arguments, generator) {
        if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
        var g = generator.apply(thisArg, _arguments || []), i, q = [];
        return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i;
        function verb(n) { if (g[n]) i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; }
        function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
        function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r);  }
        function fulfill(value) { resume("next", value); }
        function reject(value) { resume("throw", value); }
        function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
    };

    __asyncDelegator = function (o) {
        var i, p;
        return i = {}, verb("next"), verb("throw", function (e) { throw e; }), verb("return"), i[Symbol.iterator] = function () { return this; }, i;
        function verb(n, f) { i[n] = o[n] ? function (v) { return (p = !p) ? { value: __await(o[n](v)), done: n === "return" } : f ? f(v) : v; } : f; }
    };

    __asyncValues = function (o) {
        if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
        var m = o[Symbol.asyncIterator], i;
        return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
        function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
        function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
    };

    __makeTemplateObject = function (cooked, raw) {
        if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
        return cooked;
    };

    __importStar = function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
        result["default"] = mod;
        return result;
    };

    __importDefault = function (mod) {
        return (mod && mod.__esModule) ? mod : { "default": mod };
    };

    exporter("__extends", __extends);
    exporter("__assign", __assign);
    exporter("__rest", __rest);
    exporter("__decorate", __decorate);
    exporter("__param", __param);
    exporter("__metadata", __metadata);
    exporter("__awaiter", __awaiter);
    exporter("__generator", __generator);
    exporter("__exportStar", __exportStar);
    exporter("__values", __values);
    exporter("__read", __read);
    exporter("__spread", __spread);
    exporter("__spreadArrays", __spreadArrays);
    exporter("__await", __await);
    exporter("__asyncGenerator", __asyncGenerator);
    exporter("__asyncDelegator", __asyncDelegator);
    exporter("__asyncValues", __asyncValues);
    exporter("__makeTemplateObject", __makeTemplateObject);
    exporter("__importStar", __importStar);
    exporter("__importDefault", __importDefault);
});

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}]},{},[2])(2)
});

//# sourceMappingURL=threadedClass.js.map
