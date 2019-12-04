"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const child_process_1 = require("child_process");
const fakeProcess_1 = require("./fakeProcess");
const internalApi_1 = require("./internalApi");
const events_1 = require("events");
const lib_1 = require("./lib");
const webWorkers_1 = require("./webWorkers");
const workerThreads_1 = require("./workerThreads");
class ThreadedClassManagerClass {
    constructor(internal) {
        this._internal = internal;
        this._internal.setMaxListeners(0);
    }
    /** Destroy a proxy class */
    destroy(proxy) {
        return this._internal.killProxy(proxy);
    }
    destroyAll() {
        return this._internal.killAllChildren();
    }
    getThreadCount() {
        return this._internal.getChildrenCount();
    }
    onEvent(proxy, event, cb) {
        const onEvent = (child) => {
            let foundChild = Object.keys(child.instances).find((instanceId) => {
                const instance = child.instances[instanceId];
                return instance.proxy === proxy;
            });
            if (foundChild) {
                cb();
            }
        };
        this._internal.on(event, onEvent);
        return {
            stop: () => {
                this._internal.removeListener(event, onEvent);
            }
        };
    }
    /**
     * Restart the thread of the proxy instance
     * @param proxy
     * @param forceRestart If true, will kill the thread and restart it
     */
    restart(proxy, forceRestart) {
        return this._internal.restart(proxy, forceRestart);
    }
    /**
     * Returns a description of what threading mode the library will use in the current context.
     */
    getThreadMode() {
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
    }
}
exports.ThreadedClassManagerClass = ThreadedClassManagerClass;
function childName(child) {
    return `Child_ ${Object.keys(child.instances).join(',')}`;
}
exports.childName = childName;
class ThreadedClassManagerClassInternal extends events_1.EventEmitter {
    constructor() {
        super(...arguments);
        /** Set to true if you want to handle the exiting of child process yourselt */
        this.dontHandleExit = false;
        this.isInitialized = false;
        this._threadId = 0;
        this._instanceId = 0;
        this._methodId = 0;
        this._children = {};
        this._pinging = true; // for testing only
    }
    getChild(config, pathToWorker) {
        this._init();
        let child = null;
        if (config.threadId) {
            child = this._children[config.threadId] || null;
        }
        else if (config.threadUsage) {
            child = this._findFreeChild(config.threadUsage);
        }
        if (!child) {
            // Create new child process:
            const newChild = {
                id: config.threadId || ('process_' + this._threadId++),
                isNamed: !!config.threadId,
                pathToWorker: pathToWorker,
                process: this._createFork(config, pathToWorker),
                usage: config.threadUsage || 1,
                instances: {},
                methods: {},
                alive: true,
                isClosing: false,
                config,
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
    }
    /**
     * Attach a proxy-instance to a child
     * @param child
     * @param proxy
     * @param onMessage
     */
    attachInstance(config, child, proxy, pathToModule, className, classFunction, constructorArgs, onMessage) {
        const instance = {
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
    }
    killProxy(proxy) {
        return new Promise((resolve, reject) => {
            let foundProxy = false;
            Object.keys(this._children).find((childId) => {
                const child = this._children[childId];
                const instanceId = Object.keys(child.instances).find((instanceId) => {
                    let instance = child.instances[instanceId];
                    return (instance.proxy === proxy);
                });
                if (instanceId) {
                    let instance = child.instances[instanceId];
                    foundProxy = true;
                    if (Object.keys(child.instances).length === 1) {
                        // if there is only one instance left, we can kill the child
                        this.killChild(childId)
                            .then(resolve)
                            .catch(reject);
                    }
                    else {
                        const cleanup = () => {
                            delete instance.child;
                            delete child.instances[instanceId];
                        };
                        this.sendMessageToChild(instance, {
                            cmd: internalApi_1.MessageType.KILL
                        }, () => {
                            cleanup();
                            resolve();
                        });
                        setTimeout(() => {
                            cleanup();
                            reject('Timeout: Kill child instance');
                        }, 1000);
                        if (instance.usage) {
                            child.usage -= instance.usage;
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
    }
    sendMessageToChild(instance, messageConstr, cb) {
        try {
            if (!instance.child)
                throw new Error(`Instance ${instance.id} has been detached from child process`);
            if (!instance.child.alive)
                throw new Error(`Child process of instance ${instance.id} has been closed`);
            if (instance.child.isClosing)
                throw new Error(`Child process of instance ${instance.id} is closing`);
            const message = Object.assign(Object.assign({}, messageConstr), {
                cmdId: instance.child.cmdId++,
                instanceId: instance.id
            });
            if (message.cmd !== internalApi_1.MessageType.INIT &&
                !instance.initialized)
                throw Error(`Child instance ${instance.id} is not initialized`);
            if (cb)
                instance.child.queue[message.cmdId + ''] = cb;
            try {
                instance.child.process.send(message, (error) => {
                    if (error) {
                        if (instance.child.queue[message.cmdId + '']) {
                            instance.child.queue[message.cmdId + ''](instance, new Error(`Error sending message to child process of instance ${instance.id}: ` + error));
                            delete instance.child.queue[message.cmdId + ''];
                        }
                    }
                });
            }
            catch (e) {
                if ((e.toString() || '').match(/circular structure/)) { // TypeError: Converting circular structure to JSON
                    throw new Error(`Unsupported attribute (circular structure) in instance ${instance.id}: ` + e.toString());
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
    }
    getChildrenCount() {
        return Object.keys(this._children).length;
    }
    killAllChildren() {
        return Promise.all(Object.keys(this._children).map((id) => {
            return this.killChild(id);
        })).then(() => {
            return;
        });
    }
    restart(proxy, forceRestart) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let foundInstance;
            let foundChild;
            Object.keys(this._children).find((childId) => {
                const child = this._children[childId];
                const found = Object.keys(child.instances).find((instanceId) => {
                    const instance = child.instances[instanceId];
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
                throw Error(`Child of proxy not found`);
            if (!foundInstance)
                throw Error(`Instance of proxy not found`);
            yield this.restartChild(foundChild, [foundInstance], forceRestart);
        });
    }
    restartChild(child, onlyInstances, forceRestart) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (child.alive && forceRestart) {
                yield this.killChild(child, true);
            }
            if (!child.alive) {
                // clear old process:
                child.process.removeAllListeners();
                delete child.process;
                Object.keys(child.instances).forEach((instanceId) => {
                    const instance = child.instances[instanceId];
                    instance.initialized = false;
                });
                // start new process
                child.alive = true;
                child.isClosing = false;
                child.process = this._createFork(child.config, child.pathToWorker);
                this._setupChildProcess(child);
            }
            let p = new Promise((resolve, reject) => {
                const onInit = (child) => {
                    if (child === child) {
                        resolve();
                        this.removeListener('initialized', onInit);
                    }
                };
                this.on('initialized', onInit);
                setTimeout(() => {
                    reject('Timeout when trying to restart');
                    this.removeListener('initialized', onInit);
                }, 1000);
            });
            const promises = [];
            let instances = (onlyInstances ||
                Object.keys(child.instances).map((instanceId) => {
                    return child.instances[instanceId];
                }));
            instances.forEach((instance) => {
                promises.push(new Promise((resolve, reject) => {
                    this.sendInit(child, instance, instance.config, (_instance, err) => {
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
            yield Promise.all(promises);
            yield p;
        });
    }
    sendInit(child, instance, config, cb) {
        let encodedArgs = internalApi_1.encodeArguments(instance, instance.child.callbacks, instance.constructorArgs, !!config.disableMultithreading);
        let msg = {
            cmd: internalApi_1.MessageType.INIT,
            modulePath: instance.pathToModule,
            className: instance.className,
            classFunction: (config.disableMultithreading ? instance.classFunction : undefined),
            args: encodedArgs,
            config: config
        };
        instance.initialized = true;
        exports.ThreadedClassManagerInternal.sendMessageToChild(instance, msg, (instance, e, initProps) => {
            if (!cb ||
                cb(instance, e, initProps)) {
                this.emit('initialized', child);
            }
        });
    }
    startMonitoringChild(instance) {
        const pingTime = instance.freezeLimit || internalApi_1.DEFAULT_CHILD_FREEZE_TIME;
        const monitorChild = () => {
            if (instance.child && instance.child.alive && this._pinging) {
                this._pingChild(instance)
                    .then(() => {
                    // ping successful
                    // ping again later:
                    setTimeout(() => {
                        monitorChild();
                    }, pingTime);
                })
                    .catch(() => {
                    // Ping failed
                    if (instance.child &&
                        instance.child.alive &&
                        !instance.child.isClosing) {
                        // console.log(`Ping failed for Child "${instance.child.id }" of instance "${instance.id}"`)
                        this._childHasCrashed(instance.child, `Child process of instance ${instance.id} ping timeout`);
                    }
                });
            }
        };
        setTimeout(() => {
            monitorChild();
        }, pingTime);
    }
    doMethod(child, cb) {
        // Return a promise that will execute the callback cb
        // but also put the promise in child.methods, so that the promise can be aborted
        // in the case of a child crash
        const methodId = 'm' + this._methodId++;
        const p = new Promise((resolve, reject) => {
            child.methods[methodId] = { resolve, reject };
            cb(resolve, reject);
        })
            .then((result) => {
            delete child.methods[methodId];
            return result;
        })
            .catch((error) => {
            delete child.methods[methodId];
            throw error;
        });
        return p;
    }
    /** Called before using internally */
    _init() {
        if (!this.isInitialized &&
            !this.dontHandleExit) {
            if (!lib_1.isBrowser()) { // in NodeJS
                // Close the child processes upon exit:
                process.stdin.resume(); // so the program will not close instantly
                const exitHandler = (options, err) => {
                    this.killAllChildren()
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
    }
    _pingChild(instance) {
        return new Promise((resolve, reject) => {
            let msg = {
                cmd: internalApi_1.MessageType.PING
            };
            exports.ThreadedClassManagerInternal.sendMessageToChild(instance, msg, (_instance, err) => {
                if (!err) {
                    resolve();
                }
                else {
                    console.log('error', err);
                    reject();
                }
            });
            setTimeout(() => {
                reject(); // timeout
            }, instance.freezeLimit || internalApi_1.DEFAULT_CHILD_FREEZE_TIME);
        });
    }
    _childHasCrashed(child, reason) {
        // Called whenever a fatal error with a child has been discovered
        this.rejectChildMethods(child, reason);
        if (!child.isClosing) {
            let shouldRestart = false;
            const restartInstances = [];
            Object.keys(child.instances).forEach((instanceId) => {
                const instance = child.instances[instanceId];
                if (instance.config.autoRestart) {
                    shouldRestart = true;
                    restartInstances.push(instance);
                }
            });
            if (shouldRestart) {
                this.restartChild(child, restartInstances, true)
                    .then(() => {
                    this.emit('restarted', child);
                })
                    .catch((err) => console.log('Error when running restartChild()', err));
            }
            else {
                // No instance wants to be restarted, make sure the child is killed then:
                if (child.alive) {
                    this.killChild(child, true)
                        .catch((err) => console.log('Error when running killChild()', err));
                }
            }
        }
    }
    _createFork(config, pathToWorker) {
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
    }
    _setupChildProcess(child) {
        child.process.on('close', (_code) => {
            if (child.alive) {
                child.alive = false;
                this.emit('thread_closed', child);
                this._childHasCrashed(child, `Child process "${childName(child)}" was closed`);
            }
        });
        child.process.on('error', (err) => {
            console.error('Error from child ' + child.id, err);
        });
        child.process.on('message', (message) => {
            if (message.cmd === internalApi_1.MessageType.LOG) {
                console.log(message.instanceId, ...message.log);
            }
            else {
                const instance = child.instances[message.instanceId];
                if (instance) {
                    try {
                        instance.onMessageCallback(instance, message);
                    }
                    catch (e) {
                        console.error(`Error in onMessageCallback in instance ${instance.id}`, message, instance);
                        console.error(e);
                        throw e;
                    }
                }
                else {
                    console.error(`Instance "${message.instanceId}" not found`);
                }
            }
        });
    }
    _findFreeChild(threadUsage) {
        let id = Object.keys(this._children).find((id) => {
            const child = this._children[id];
            if (!child.isNamed &&
                child.usage + threadUsage <= 1) {
                return true;
            }
            return false;
        });
        if (id) {
            const child = this._children[id];
            child.usage += threadUsage;
            return child;
        }
        return null;
    }
    killChild(idOrChild, dontCleanUp) {
        return new Promise((resolve, reject) => {
            let child;
            if (typeof idOrChild === 'string') {
                const id = idOrChild;
                child = this._children[id];
                if (!child) {
                    reject(`killChild: Child ${id} not found`);
                    return;
                }
            }
            else {
                child = idOrChild;
            }
            if (child) {
                if (!child.alive) {
                    delete this._children[child.id];
                    resolve();
                }
                else {
                    child.process.once('close', () => {
                        if (!dontCleanUp) {
                            // Clean up:
                            Object.keys(child.instances).forEach(instanceId => {
                                const instance = child.instances[instanceId];
                                delete instance.child;
                                delete child.instances[instanceId];
                            });
                            delete this._children[child.id];
                        }
                        resolve();
                    });
                    setTimeout(() => {
                        delete this._children[child.id];
                        reject('Timeout: Kill child process');
                    }, 1000);
                    if (!child.isClosing) {
                        child.isClosing = true;
                        child.process.kill();
                    }
                }
            }
        });
    }
    rejectChildMethods(child, reason) {
        Object.keys(child.methods).forEach((methodId) => {
            const method = child.methods[methodId];
            method.reject(Error('Method aborted due to: ' + reason));
        });
        child.methods = {};
    }
}
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