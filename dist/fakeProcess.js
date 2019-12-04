"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const internalApi_1 = require("./internalApi");
class FakeWorker extends internalApi_1.Worker {
    constructor(cb) {
        super();
        this.disabledMultithreading = true;
        this.mockProcessSend = cb;
    }
    killInstance() {
        // throw new Error('Trying to kill a non threaded process!')
    }
    sendMessageToParent(handle, msg, cb) {
        if (msg.cmd === internalApi_1.MessageType.LOG) {
            const message = Object.assign(Object.assign({}, msg), {
                cmdId: 0,
                instanceId: ''
            });
            // Send message to Parent:
            this.mockProcessSend(message);
        }
        else {
            const message = Object.assign(Object.assign({}, msg), {
                cmdId: handle.cmdId++,
                instanceId: handle.id
            });
            if (cb)
                handle.queue[message.cmdId + ''] = cb;
            // Send message to Parent:
            this.mockProcessSend(message);
        }
    }
}
exports.FakeWorker = FakeWorker;
class FakeProcess extends events_1.EventEmitter {
    constructor() {
        super();
        this.killed = false;
        this.pid = 0;
        this.connected = true;
        this.worker = new FakeWorker((m) => {
            this.emit('message', m);
        });
    }
    kill() {
        // @todo: needs some implementation.
        this.emit('close');
        // throw new Error('Function kill in FakeProcess is not implemented.')
    }
    send(m) {
        this.worker.onMessageFromParent(m);
        return true;
    }
    disconnect() {
        throw new Error('Function disconnect in FakeProcess is not implemented.');
    }
    unref() {
        throw new Error('Function unref in FakeProcess is not implemented.');
    }
    ref() {
        throw new Error('Function ref in FakeProcess is not implemented.');
    }
}
exports.FakeProcess = FakeProcess;
//# sourceMappingURL=fakeProcess.js.map