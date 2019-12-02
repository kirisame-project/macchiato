import loglevel from 'loglevel'
import * as uuid from 'uuid/v4'

import { WebSocketConfiguration } from './config'
import { RecognitionTask } from './contracts'
import {
    CloseSession, Handshake, ImageRequest, Message, ServerHandshake,
} from './protocol'

type WebSocketClientState = 'closed' | 'connected' | 'connecting' | 'ready'

export interface WebSocketClientStatus {
    clientId: string
    serverName: string
    sessionId: string
    state: WebSocketClientState
}

const log = loglevel.getLogger('websocket')

export class WebSocketClient {
    public readonly clientId: string

    public readyState: WebSocketClientState

    public serverName: string

    public sessionId: string

    public onstatuschanged: (state: WebSocketClientStatus) => void

    public ontaskupdate: (task: RecognitionTask) => void

    private readonly config: WebSocketConfiguration

    private socket: WebSocket

    public constructor(config: WebSocketConfiguration) {
        this.config = config
        this.clientId = uuid()
        this.connect()
    }

    private connect() {
        const socket = new WebSocket(this.config.endpoint)

        socket.addEventListener('close', (event) => {
            log.error(`WebSocket closed: ${event.code} ${event.reason}`)
            this.readyState = 'closed'
            this.invokeStatusEvent()
            setTimeout(() => this.connect(), this.config.retry)
        })

        socket.addEventListener('open', () => this.handshake())

        socket.addEventListener('message', (event) => {
            const close = JSON.parse(event.data) as CloseSession
            if (close.op !== 1) return

            log.error(`Server requested session closure: ${close.code} ${close.reason}`)
            socket.close(1000, 'Server requested closure')
        })

        this.socket = socket
        this.readyState = 'connecting'
    }

    private handshake() {
        this.socket.send(JSON.stringify({
            data: {
                agent: 'BrowserEvaluationClinet/0.2.0',
                clientId: this.clientId,
            },
            op: 2,
        } as Handshake))

        this.socket.addEventListener('message', (event) => {
            this.acceptSession(event)
        }, { once: true })

        this.invokeStatusEvent()
    }

    private acceptSession(event: MessageEvent) {
        const response = JSON.parse(event.data) as Message

        if (response.op !== 2) {
            log.error(`Server failed to complete handshake: ${response}`)
            this.socket.close(1006, 'Expecting handshake response')
            return
        }

        this.serverName = (response as ServerHandshake).data.serverName
        this.sessionId = (response as ServerHandshake).data.sessionId

        this.socket.addEventListener('message', (message) => this.handleMessage(message))

        this.readyState = 'ready'

        this.invokeStatusEvent()
    }

    private handleMessage(event: MessageEvent) {
        const message = JSON.parse(event.data) as Message

        if (message.op === 4) {
            const task = message.data as RecognitionTask
            this.ontaskupdate(task)
        }
    }

    public sendImageRequest(image: Blob) {
        if (this.readyState !== 'ready') return

        // send request message
        this.socket.send(JSON.stringify({
            data: {
                contentLength: image.size,
                contentType: image.type,
            },
            op: 5,
        } as ImageRequest))

        // send request body
        this.socket.send(image)
    }

    private invokeStatusEvent() {
        if (typeof this.onstatuschanged !== 'function') return

        this.onstatuschanged({
            clientId: this.clientId,
            serverName: this.serverName,
            sessionId: this.sessionId,
            state: this.readyState,
        } as WebSocketClientStatus)
    }
}
