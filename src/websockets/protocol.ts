export interface Message {
    data: any
    op: number
}

export interface CloseSession extends Message {
    code: number
    reason: string
    op: 1
}

export interface Handshake extends Message {
    data: {
        agent: string
        clientId: string
    }
    op: 2
}

export interface ServerHandshake extends Message {
    data: {
        serverId: string
        serverName: string
        sessionId: string
    }
    op: 2
}

export interface ImageRequest extends Message {
    data: {
        contentLength: number
        contentType: string
    }
    op: 5
}
