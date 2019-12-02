import { CaptureConfiguration } from './capture/config'
import { RendererConfiguration } from './render/config'
import { WebSocketConfiguration } from './websockets/config'

export interface AppConfiguration {
    capture: CaptureConfiguration
    debug: boolean
    render: RendererConfiguration
    websocket: WebSocketConfiguration
}
