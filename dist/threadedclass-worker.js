"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
var internalApi_1 = require("./internalApi");
var lib_1 = require("./lib");
var WorkerThreads = lib_1.getWorkerThreads();
/* This file is the one that is launched in the worker child process */
function send(message) {
    if (WorkerThreads) {
        if (WorkerThreads.parentPort) {
            WorkerThreads.parentPort.postMessage(message);
        }
        else {
            throw Error('WorkerThreads.parentPort not set!');
        }
    }
    else if (process.send) {
        process.send(message);
        // @ts-ignore global postMessage
    }
    else if (postMessage) {
        // @ts-ignore
        postMessage(message);
    }
    else
        throw Error('process.send and postMessage are undefined!');
}
var ThreadedWorker = /** @class */ (function (_super) {
    tslib_1.__extends(ThreadedWorker, _super);
    function ThreadedWorker() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.instanceHandles = {};
        return _this;
    }
    ThreadedWorker.prototype.sendMessageToParent = function (handle, msg, cb) {
        if (msg.cmd === internalApi_1.MessageType.LOG) {
            var message = tslib_1.__assign({}, msg, {
                cmdId: 0,
                instanceId: ''
            });
            send(message);
        }
        else {
            var message = tslib_1.__assign({}, msg, {
                cmdId: handle.cmdId++,
                instanceId: handle.id
            });
            if (cb)
                handle.queue[message.cmdId + ''] = cb;
            send(message);
        }
    };
    ThreadedWorker.prototype.killInstance = function (handle) {
        delete this.instanceHandles[handle.id];
    };
    return ThreadedWorker;
}(internalApi_1.Worker));
// const _orgConsoleLog = console.log
if (lib_1.isBrowser()) {
    var worker_1 = new ThreadedWorker();
    // console.log = worker.log
    // @ts-ignore global onmessage
    onmessage = function (m) {
        // Received message from parent
        if (m.type === 'message') {
            worker_1.onMessageFromParent(m.data);
        }
        else {
            console.log('child process: onMessage', m);
        }
    };
}
else if (lib_1.nodeSupportsWorkerThreads()) {
    if (WorkerThreads) {
        var worker_2 = new ThreadedWorker();
        console.log = worker_2.log;
        console.error = worker_2.logError;
        if (WorkerThreads.parentPort) {
            WorkerThreads.parentPort.on('message', function (m) {
                // Received message from parent
                worker_2.onMessageFromParent(m);
            });
        }
        else {
            throw Error('WorkerThreads.parentPort not set!');
        }
    }
    else {
        throw Error('WorkerThreads not available!');
    }
}
else if (process.send) {
    var worker_3 = new ThreadedWorker();
    console.log = worker_3.log;
    console.error = worker_3.logError;
    process.on('message', function (m) {
        // Received message from parent
        worker_3.onMessageFromParent(m);
    });
}
else {
    throw Error('process.send and onmessage are undefined!');
}
//# sourceMappingURL=threadedclass-worker.js.map