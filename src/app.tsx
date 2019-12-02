import React, { useRef, useEffect, useState } from 'react'

import { openDeviceStream } from './capture/camera'
import { CaptureService } from './capture/capture'
import { AppConfiguration } from './config'
import { getLogger } from './log'
import { WebSocketClient } from './websockets/client'
import { Renderer } from './render/renderer'

import './app.css'

const log = getLogger('main')

function createVideoElement(height: number, width: number) {
    const video = document.createElement('video')
    video.autoplay = true
    video.height = height
    video.width = width
    return video
}

export function AppMain(props: { config: AppConfiguration }) {
    const { config } = props
    const { capture, render, websocket } = config

    const canvas = useRef<HTMLCanvasElement>(null)

    const camera = useRef<CaptureService>(null)
    const client = useRef<WebSocketClient>(null)
    const renderer = useRef<Renderer>(null)
    const [stream, setStream] = useState<MediaStream>(null)
    const video = useRef(createVideoElement(capture.height, capture.width))

    if (stream === null) {
        log.debug('Try opening camera stream')
        openDeviceStream(capture, undefined).then((newStream) => {
            if (newStream === stream) return

            if (newStream.getVideoTracks().length === 0) {
                throw new Error('Unexpected empty video stream')
            }

            log.debug('Switching to new stream: ', newStream)

            if (stream instanceof MediaStream) {
                stream.getVideoTracks().forEach((track) => track.stop())
            }

            setStream(newStream)
        }).catch((error) => {
            log.error('Open device stream failed: ', error)
            setStream(null)
        })
    }

    if (video.current.srcObject !== stream) {
        video.current.srcObject = stream
    }

    if (camera.current === null || camera.current.video !== video.current) {
        log.debug('Initialize capture service')
        camera.current = new CaptureService(video.current)
    }

    if (client.current === null) {
        client.current = new WebSocketClient(websocket)
        client.current.onstatuschanged = function update(status) {
            if (renderer.current !== null) {
                renderer.current.content.stats.websocket = status
            } else {
                setTimeout(() => update(status), 1000) // defer update
            }
        }
        client.current.ontaskupdate = (task) => {
            if (renderer.current === null) return

            if (task.detection.state === 'Succeeded') {
                renderer.current.content.detected = task
                setTimeout(() => {
                    if (renderer.current.content.detected === task) {
                        renderer.current.content.detected = undefined
                    }
                }, 500)
            }

            if (task.search.state === 'Succeeded') {
                renderer.current.content.result = task
                setTimeout(() => {
                    if (renderer.current.content.result === task) {
                        renderer.current.content.result = undefined
                    }
                }, 500)
            }
        }
    }

    if (renderer.current === null && canvas.current !== null) {
        log.debug('Initialize canvas renderer')
        renderer.current = new Renderer(canvas.current, render)
    }

    if (renderer.current && renderer.current.video !== video.current) {
        log.debug('Update renderer video source', video.current)
        renderer.current.video = video.current
    }

    useEffect(() => {
        let stopping = false

        if (client.current !== null && camera.current !== null) {
            const invokeCapture = async () => {
                if (stopping) return

                const image = await camera.current.getBlob()
                client.current.sendImageRequest(image)
                setTimeout(() => invokeCapture(), 250)
            }
            setImmediate(() => invokeCapture())
        }

        if (renderer.current !== null) {
            let frames = 0

            const invokeRender = () => {
                if (stopping) return

                frames += 1
                renderer.current.render()
                setTimeout(() => invokeRender(), 25)
            }

            const clearFrameCounter = () => {
                if (stopping) return

                renderer.current.content.stats.frameRate = frames
                frames = 0
                setTimeout(() => clearFrameCounter(), 1000)
            }

            setImmediate(() => invokeRender())
            setImmediate(() => clearFrameCounter())
        }

        return () => { stopping = true }
    })

    return (
        <div id="app-container">
            <canvas className="target" ref={canvas} height={`${capture.height}px`} width={`${capture.width}px`} />
        </div>
    )
}
