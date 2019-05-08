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
//# sourceMappingURL=workerThreads.js.map