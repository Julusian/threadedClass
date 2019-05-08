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
//# sourceMappingURL=webWorkers.js.map