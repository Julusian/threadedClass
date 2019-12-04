"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
/** Functions for emulating child-process in web-workers */
function forkWebWorker(pathToWorker) {
    return new WebWorkerProcess(pathToWorker);
}
exports.forkWebWorker = forkWebWorker;
class WebWorkerProcess extends events_1.EventEmitter {
    constructor(pathToWorker) {
        super();
        this.killed = false;
        this.pid = 0;
        this.connected = true;
        try {
            // @ts-ignore
            this.worker = new window.Worker(pathToWorker);
            this.worker.onmessage = (message) => {
                if (message.type === 'message') {
                    this.emit('message', message.data);
                }
                else
                    console.log('unknown message type', message);
            };
            this.worker.onmessageerror = (error) => {
                console.error('ww message error', error);
            };
            this.worker.onerror = (error) => {
                console.error('ww error', error);
            };
        }
        catch (error) {
            let str = (error.stack || error).toString() + '';
            if (str.match(/cannot be accessed from origin/) &&
                str.match(/file:\/\//)) {
                throw Error('Unable to create Web-Worker. Not allowed to run from local file system.\n' + str);
            }
            else {
                throw error;
            }
        }
        // this.worker.postMessage([first.value,second.value]); // Sending message as an array to the worker
    }
    kill() {
        this.worker.terminate();
        this.emit('close');
        // throw new Error('Function kill in WebWorker is not implemented.')
    }
    send(message) {
        this.worker.postMessage(message);
        // this.worker.onMessageFromParent(m)
        return true;
    }
    disconnect() {
        throw new Error('Function disconnect in WebWorker is not implemented.');
    }
    unref() {
        throw new Error('Function unref in WebWorker is not implemented.');
    }
    ref() {
        throw new Error('Function ref in WebWorker is not implemented.');
    }
}
exports.WebWorkerProcess = WebWorkerProcess;
//# sourceMappingURL=webWorkers.js.map