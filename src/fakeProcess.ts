import { ChildProcess, StdioStreams } from 'child_process'
import { Writable, Readable } from 'stream'
import { EventEmitter } from 'events'
import {
	MessageType,
	MessageToChild,
	MessageFromChild,
	MessageFromChildLogConstr,
	MessageFromChildReplyConstr,
	MessageFromChildCallbackConstr,
	CallbackFunction,
	ArgDefinition,
	MessageFromChildConstr,
	Worker
} from './internalApi'

export class FakeWorker extends Worker {
	protected getAllProperties = getAllProperties
	private messageCb: (m: MessageFromChild) => void

	constructor (cb: (m: MessageFromChild) => void) {
		super()
		this.messageCb = cb
	}

	protected killInstance () {
		// throw new Error('Trying to kill a non threaded process!')
	}

	protected _orgConsoleLog (...args: any[]) {
		console.log(...args)
	}

	protected fixArgs (handle: InstanceHandle, args: Array<ArgDefinition>) {
		// Go through arguments and de-serialize them
		return args.map((a) => {
			if (a.type === 'string') return a.value
			if (a.type === 'number') return a.value
			if (a.type === 'Buffer') return Buffer.from(a.value, 'hex')
			if (a.type === 'function') {
				return ((...args: any[]) => {
					return new Promise((resolve, reject) => {
						this.sendCallback(
							handle,
							a.value,
							args,
							(err, result) => {
								if (err) reject(err)
								else resolve(result)
							}
						)
					})
				})
			}
			return a.value
		})
	}
	protected reply (handle: InstanceHandle, m: MessageToChild, reply: any) {
		this.sendReply(handle, m.cmdId, undefined, reply)
	}
	protected replyError (handle: InstanceHandle, m: MessageToChild, error: any) {
		this.sendReply(handle, m.cmdId, error)
	}
	protected sendReply (handle: InstanceHandle, replyTo: number, error?: Error, reply?: any) {
		let msg: MessageFromChildReplyConstr = {
			cmd: MessageType.REPLY,
			replyTo: replyTo,
			error: error,
			reply: reply
		}
		this.processSend(handle, msg)
	}
	protected log (handle: InstanceHandle, ...data: any[]) {
		this.sendLog(handle, data)
	}
	protected sendLog (handle: InstanceHandle, log: any[]) {
		let msg: MessageFromChildLogConstr = {
			cmd: MessageType.LOG,
			log: log
		}
		this.processSend(handle, msg)
	}
	protected sendCallback (handle: InstanceHandle, callbackId: string, args: any[], cb: CallbackFunction) {
		let msg: MessageFromChildCallbackConstr = {
			cmd: MessageType.CALLBACK,
			callbackId: callbackId,
			args: args
		}
		this.processSend(handle, msg, cb)
	}
	protected processSend (handle: InstanceHandle, msg: MessageFromChildConstr, cb?: CallbackFunction) {
		const message: MessageFromChild = {...msg, ...{
			cmdId: handle.cmdId++,
			instanceId: handle.id
		}}
		if (cb) handle.queue[message.cmdId + ''] = cb
		this.messageCb(message)
	}
}

export class FakeProcess extends EventEmitter implements ChildProcess {
	stdin: Writable
	stdout: Readable
	stderr: Readable
	stdio: StdioStreams
	killed: boolean = false
	pid: number = 0
	connected: boolean = true

	private worker: FakeWorker

	constructor () {
		super()
		this.worker = new FakeWorker((m) => {
			this.emit('message', m)
		})
	}

	kill (): void {
		// @todo: needs some implementation.
		this.emit('close')
		// throw new Error('Function kill in FakeProcess is not implemented.')
	}

	send (m: any) {
		this.worker.messageCallback(m)
		return true
	}

	disconnect (): void {
		throw new Error('Function disconnect in FakeProcess is not implemented.')
	}

	unref (): void {
		throw new Error('Function unref in FakeProcess is not implemented.')
	}

	ref (): void {
		throw new Error('Function ref in FakeProcess is not implemented.')
	}
}

export function getAllProperties (obj: Object) {
	let props: Array<string> = []

	do {
		props = props.concat(Object.getOwnPropertyNames(obj))
		obj = Object.getPrototypeOf(obj)
	} while (obj)
	return props
}
export interface InstanceHandle {
	id: string
	cmdId: number
	queue: {[cmdId: string]: CallbackFunction}

	instance: any
}