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
        var _this = this;
        var onEvent = function (child) {
            var foundChild = Object.keys(child.instances).find(function (instanceId) {
                var instance = child.instances[instanceId];
                return instance.proxy === proxy;
            });
            if (foundChild) {
                cb();
            }
        };
        this._internal.on(event, onEvent);
        return {
            stop: function () {
                _this._internal.removeListener(event, onEvent);
            }
        };
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
function childName(child) {
    return "Child_ " + Object.keys(child.instances).join(',');
}
exports.childName = childName;
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
            id: 'instance_' + this._instanceId++ + (config.instanceName ? '_' + config.instanceName : ''),
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
                throw new Error("Instance " + instance.id + " has been detached from child process");
            if (!instance.child.alive)
                throw new Error("Child process of instance " + instance.id + " has been closed");
            if (instance.child.isClosing)
                throw new Error("Child process of instance " + instance.id + " is closing");
            var message_1 = tslib_1.__assign({}, messageConstr, {
                cmdId: instance.child.cmdId++,
                instanceId: instance.id
            });
            if (message_1.cmd !== internalApi_1.MessageType.INIT &&
                !instance.initialized)
                throw Error("Child instance " + instance.id + " is not initialized");
            if (cb)
                instance.child.queue[message_1.cmdId + ''] = cb;
            try {
                instance.child.process.send(message_1, function (error) {
                    if (error) {
                        if (instance.child.queue[message_1.cmdId + '']) {
                            instance.child.queue[message_1.cmdId + ''](instance, new Error("Error sending message to child process of instance " + instance.id + ": " + error));
                            delete instance.child.queue[message_1.cmdId + ''];
                        }
                    }
                });
            }
            catch (e) {
                if ((e.toString() || '').match(/circular structure/)) { // TypeError: Converting circular structure to JSON
                    throw new Error("Unsupported attribute (circular structure) in instance " + instance.id + ": " + e.toString());
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
                            throw Error("Child of proxy not found");
                        if (!foundInstance)
                            throw Error("Instance of proxy not found");
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
                        _this._childHasCrashed(instance.child, "Child process of instance " + instance.id + " ping timeout");
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
                _this._childHasCrashed(child, "Child process \"" + childName(child) + "\" was closed");
            }
        });
        child.process.on('error', function (err) {
            console.error('Error from child ' + child.id, err);
        });
        child.process.on('message', function (message) {
            if (message.cmd === internalApi_1.MessageType.LOG) {
                console.log.apply(console, [message.instanceId].concat(message.log));
            }
            else {
                var instance = child.instances[message.instanceId];
                if (instance) {
                    try {
                        instance.onMessageCallback(instance, message);
                    }
                    catch (e) {
                        console.error("Error in onMessageCallback in instance " + instance.id, message, instance);
                        console.error(e);
                        throw e;
                    }
                }
                else {
                    console.error("Instance \"" + message.instanceId + "\" not found");
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
//# sourceMappingURL=manager.js.map