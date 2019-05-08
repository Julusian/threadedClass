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
//# sourceMappingURL=fakeProcess.js.map