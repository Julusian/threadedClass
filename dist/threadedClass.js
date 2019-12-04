"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const callsites = require("callsites");
const internalApi_1 = require("./internalApi");
const manager_1 = require("./manager");
const lib_1 = require("./lib");
/**
 * Returns an asynchronous version of the provided class
 * @param orgModule Path to imported module (this is what is in the require('XX') function, or import {class} from 'XX'} )
 * @param orgClass The class to be threaded
 * @param constructorArgs An array of arguments to be fed into the class constructor
 */
function threadedClass(orgModule, orgClass, constructorArgs, config = {}) {
    let orgClassName = orgClass.name;
    if (lib_1.isBrowser()) {
        if (!config.pathToWorker) {
            throw Error('config.pathToWorker is required in browser');
        }
        if (!lib_1.browserSupportsWebWorkers()) {
            console.log('Web-workers not supported, disabling multi-threading');
            config.disableMultithreading = true;
        }
    }
    let parentCallPath = callsites()[1].getFileName();
    let thisCallPath = callsites()[0].getFileName();
    return new Promise((resolve, reject) => {
        function sendFcn(instance, fcn, args, cb) {
            let msg = {
                cmd: internalApi_1.MessageType.FUNCTION,
                fcn: fcn,
                args: args
            };
            manager_1.ThreadedClassManagerInternal.sendMessageToChild(instance, msg, cb);
        }
        function sendSet(instance, property, value, cb) {
            let msg = {
                cmd: internalApi_1.MessageType.SET,
                property: property,
                value: value
            };
            manager_1.ThreadedClassManagerInternal.sendMessageToChild(instance, msg, cb);
        }
        function sendReply(instance, replyTo, error, reply, cb) {
            let msg = {
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
            let msg = {
                cmd: internalApi_1.MessageType.CALLBACK,
                callbackId: callbackId,
                args: args
            };
            manager_1.ThreadedClassManagerInternal.sendMessageToChild(instance, msg, cb);
        }
        function decodeResultFromWorker(instance, encodedResult) {
            return internalApi_1.decodeArguments(() => instance.proxy, [encodedResult], (a) => {
                return (...args) => {
                    return new Promise((resolve, reject) => {
                        // Function result function is called from parent
                        sendCallback(instance, a.value, args, (_instance, err, encodedResult) => {
                            // Function result is returned from worker
                            if (err) {
                                reject(err);
                            }
                            else {
                                let result = decodeResultFromWorker(_instance, encodedResult);
                                resolve(result);
                            }
                        });
                    });
                };
            })[0];
        }
        function onMessage(instance, m) {
            if (m.cmd === internalApi_1.MessageType.REPLY) {
                let msg = m;
                const child = instance.child;
                let cb = child.queue[msg.replyTo + ''];
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
                let msg = m;
                let callback = instance.child.callbacks[msg.callbackId];
                if (callback) {
                    try {
                        Promise.resolve(callback(...msg.args))
                            .then((result) => {
                            let encodedResult = internalApi_1.encodeArguments(instance, instance.child.callbacks, [result], !!config.disableMultithreading);
                            sendReply(instance, msg.cmdId, undefined, encodedResult[0]);
                        })
                            .catch((err) => {
                            replyError(instance, msg, err);
                        });
                    }
                    catch (err) {
                        replyError(instance, msg, err);
                    }
                }
                else
                    throw Error(`callback "${msg.callbackId}" not found in instance ${m.instanceId}`);
            }
        }
        try {
            let pathToModule = '';
            let pathToWorker = '';
            if (lib_1.isBrowser()) {
                pathToWorker = config.pathToWorker;
                pathToModule = orgModule;
            }
            else {
                if (!parentCallPath)
                    throw new Error('Unable to resolve parent file path');
                if (!thisCallPath)
                    throw new Error('Unable to resolve own file path');
                let absPathToModule = (orgModule.match(/^\./) ?
                    path.resolve(parentCallPath, '../', orgModule) :
                    orgModule);
                pathToModule = require.resolve(absPathToModule);
                pathToWorker = thisCallPath
                    .replace(/threadedClass(\.[tj]s)$/, 'threadedclass-worker.js')
                    .replace(/src([\\\/])threadedclass-worker/, 'dist$1threadedclass-worker');
            }
            const child = manager_1.ThreadedClassManagerInternal.getChild(config, pathToWorker);
            const proxy = {};
            let instanceInChild = manager_1.ThreadedClassManagerInternal.attachInstance(config, child, proxy, pathToModule, orgClassName, orgClass, constructorArgs, onMessage);
            manager_1.ThreadedClassManagerInternal.sendInit(child, instanceInChild, config, (instance, err, props) => {
                // This callback is called from the worker process, with a list of supported properties of the c
                if (err) {
                    reject(err);
                    return false;
                }
                else {
                    props.forEach((p) => {
                        if (!instance.child.alive)
                            throw Error(`Child process of instance ${instance.id} has been closed`);
                        if (proxy.hasOwnProperty(p.key)) {
                            return;
                        }
                        if (p.type === internalApi_1.InitPropType.FUNCTION) {
                            const fcn = (...args) => {
                                // An instance method is called by parent
                                const originalStack = 'Original stack:\n' + new Error().stack;
                                if (!instance.child)
                                    return Promise.reject(new Error(`Instance ${instance.id} has been detached from child process`));
                                return manager_1.ThreadedClassManagerInternal.doMethod(instance.child, (resolve, reject) => {
                                    if (!instance.child)
                                        throw new Error(`Instance ${instance.id} has been detached from child process`);
                                    // Go through arguments and serialize them:
                                    let encodedArgs = internalApi_1.encodeArguments(instance, instance.child.callbacks, args, !!config.disableMultithreading);
                                    sendFcn(instance, p.key, encodedArgs, (_instance, err, encodedResult) => {
                                        // Function result is returned from worker
                                        if (err) {
                                            if (typeof err === 'string') {
                                                err += '\n' + originalStack;
                                            }
                                            else {
                                                err.stack += '\n' + originalStack;
                                            }
                                            reject(err);
                                        }
                                        else {
                                            let result = decodeResultFromWorker(_instance, encodedResult);
                                            resolve(result);
                                        }
                                    });
                                });
                            };
                            // @ts-ignore
                            proxy[p.key] = fcn;
                        }
                        else if (p.type === internalApi_1.InitPropType.VALUE) {
                            let m = {
                                configurable: false,
                                enumerable: p.descriptor.enumerable
                                // writable: // We handle everything through getters & setters instead
                            };
                            if (p.descriptor.get ||
                                p.descriptor.readable) {
                                m.get = function () {
                                    return new Promise((resolve, reject) => {
                                        sendFcn(instance, p.key, [], (_instance, err, encodedResult) => {
                                            if (err) {
                                                reject(err);
                                            }
                                            else {
                                                let result = decodeResultFromWorker(_instance, encodedResult);
                                                resolve(result);
                                            }
                                        });
                                    });
                                };
                            }
                            if (p.descriptor.set ||
                                p.descriptor.writable) {
                                m.set = function (newVal) {
                                    let fixedArgs = internalApi_1.encodeArguments(instance, instance.child.callbacks, [newVal], !!config.disableMultithreading);
                                    // in the strictest of worlds, we should block the main thread here,
                                    // until the remote acknowledges the write.
                                    // Instead we're going to pretend that everything is okay. *whistling*
                                    sendSet(instance, p.key, fixedArgs[0], (_instance, err, _result) => {
                                        if (err) {
                                            console.log('Error in setter', err);
                                        }
                                    });
                                };
                            }
                            Object.defineProperty(proxy, p.key, m);
                        }
                    });
                    manager_1.ThreadedClassManagerInternal.startMonitoringChild(instanceInChild);
                    resolve(proxy);
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
//# sourceMappingURL=threadedClass.js.map