import React from 'react'
import ReactDOM from 'react-dom'

import { AppMain } from './app'
import { AppConfiguration } from './config'
import { getLogger, setDebug } from './log'

const log = getLogger('loader')

async function getConfiguration() {
    const file = await fetch('config.json')
    return file.json<AppConfiguration>()
}

async function init() {
    log.debug('Begin Early Initialization: Fetch Configuration')
    const config = await getConfiguration()
    setDebug(config.debug)

    log.debug('Begin Early Initialization: Invoke Render(AppMain)')
    ReactDOM.render(<AppMain config={config} />, document.getElementById('app-main'))

    log.debug('End Early Initialization :)')
}

init().catch((error) => {
    log.error(`Early Initialization Failed: ${error}`)
})
