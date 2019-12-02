import { RecognizedFace, RecognitionTask } from '../websockets/contracts'
import { RendererConfiguration } from './config'
import { WebSocketClientStatus } from '../websockets/client'

export interface StatsContent {
    frameRate: number
    websocket: WebSocketClientStatus
}

export interface RendererContent {
    detected: RecognitionTask
    result: RecognitionTask
    stats: StatsContent
}

export class Renderer {
    public content: RendererContent = {
        detected: undefined,
        result: undefined,
        stats: {
            frameRate: 114514,
            websocket: {
                clientId: undefined,
                serverName: undefined,
                sessionId: undefined,
                state: 'closed',
            },
        },
    }

    public video: HTMLVideoElement

    private readonly canvas: HTMLCanvasElement

    private readonly config: RendererConfiguration

    public constructor(canvas: HTMLCanvasElement, config: RendererConfiguration) {
        this.config = config
        this.canvas = canvas
    }

    public static drawFaceBox(ctx: CanvasRenderingContext2D, face: RecognizedFace) {
        const {
            x1, x2, y1, y2,
        } = face.position
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1)
    }

    public static drawText(ctx: CanvasRenderingContext2D, s: string, x: number, y: number) {
        const h = ctx.measureText('M').width * 1.5
        s.split('\n').forEach((line, i) => {
            ctx.strokeText(line, x, y + h * i)
            ctx.fillText(line, x, y + h * i)
        })
    }

    private static drawVideoLayer(ctx: CanvasRenderingContext2D, h: number, w: number,
        video?: HTMLVideoElement) {
        if (video instanceof HTMLVideoElement) {
            ctx.drawImage(video, 0, 0, w, h)
        } else {
            ctx.font = '2em sans-serif'
            ctx.fillStyle = 'red'
            ctx.strokeStyle = 'white'
            Renderer.drawText(ctx, 'No active video device stream', 0, 0)
        }
    }

    public render() {
        const ctx = this.canvas.getContext('2d')
        const { height, width } = ctx.canvas

        const { detected, result, stats } = this.content

        ctx.clearRect(0, 0, width, height)

        // configure properties
        ctx.textBaseline = 'top'
        ctx.lineJoin = 'round'

        // draw video layer
        Renderer.drawVideoLayer(ctx, height, width, this.video)

        // draw detected faces
        if (detected && detected.faces instanceof Array) {
            ctx.strokeStyle = 'grey'
            const h = ctx.measureText('M').width * 1.5
            ctx.lineWidth = h * 0.1
            detected.faces.forEach((face) => Renderer.drawFaceBox(ctx, face))
        }

        // draw recognized faces
        if (result && result.faces instanceof Array) {
            ctx.font = '2em sans-serif'
            const h = ctx.measureText('M').width * 1.5
            ctx.lineWidth = h * 0.5

            result.faces.forEach((face) => {
                const result0 = face.results[0]
                ctx.strokeStyle = result0.distance < this.config.threshold
                    ? 'rgba(195, 39, 43, 0.8)' // Akabeni
                    : 'rgba(91, 137, 48, 0.8)' // Moegi
                Renderer.drawFaceBox(ctx, face)
                const { x1, y1, y2 } = face.position
                ctx.fillStyle = 'white'
                ctx.strokeStyle = 'grey'
                Renderer.drawText(ctx, `Label #${result0.label}`, x1, y1 - h)
                Renderer.drawText(ctx, `${result0.distance}`, x1, y2)
            })
        }

        // draw stats
        ctx.font = '1.2em sans-serif'
        const h = ctx.measureText('M').width * 1.5
        ctx.lineWidth = h * 0.25
        ctx.fillStyle = 'rgba(198, 194, 182, 0.75)'
        ctx.strokeStyle = 'rgba(25, 34, 54, 0.75)'
        const statsText = `
[Renderer] frameRate=${stats.frameRate}
[Detection] ${detected ? `Count=${detected.faceCount}, Time=${detected.detection.time}` : 'No Data'}
[Detection] ${detected ? `Timestamp=${detected.detection.start}` : 'No Data'}
[Full_Task] ${result ? `Count=${result.faceCount}, Time=${result.time}` : 'No Data'}
[Full_Task] ${result ? `Timestamp=${result.start}` : 'No Data'}
[WebSocket] State=${stats.websocket.state}
[WebSocket] ClientId=${stats.websocket.clientId}
[WebSocket] SessionId=${stats.websocket.sessionId}
        `
        Renderer.drawText(ctx, statsText, 0, 0)
    }
}
