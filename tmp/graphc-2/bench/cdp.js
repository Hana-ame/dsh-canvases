'use strict'
// Minimal CDP driver: launch chromium headless, open a URL, evaluate an expression awaiting a promise.
const { spawn } = require('child_process')
const http = require('http')

const CHROME = process.env.HOME + '/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome'

function getJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let b = ''
      res.on('data', (c) => { b += c })
      res.on('end', () => { try { resolve(JSON.parse(b)) } catch (e) { reject(e) } })
    }).on('error', reject)
  })
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function launch(extraArgs) {
  const args = ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--remote-debugging-port=9333',
    '--disable-gpu-sandbox', '--window-size=1400,1000', '--allow-file-access-from-files', '--hide-scrollbars']
    .concat(extraArgs || [])
  const proc = spawn(CHROME, args, { stdio: ['ignore', 'pipe', 'pipe'] })
  let stderr = ''
  proc.stderr.on('data', (d) => { stderr += String(d) })
  for (let i = 0; i < 100; i++) {
    await sleep(100)
    try {
      const v = await getJSON('http://127.0.0.1:9333/json/version')
      if (v && v.webSocketDebuggerUrl) return { proc, wsUrl: v.webSocketDebuggerUrl, stderr: () => stderr }
    } catch (e) {}
  }
  throw new Error('chromium did not start: ' + stderr.slice(-500))
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl)
    let id = 0
    const pending = new Map()
    const events = []
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id && pending.has(msg.id)) {
        const p = pending.get(msg.id)
        pending.delete(msg.id)
        if (msg.error) p.reject(new Error(JSON.stringify(msg.error)))
        else p.resolve(msg.result)
      } else if (msg.method) {
        events.push(msg)
      }
    })
    ws.addEventListener('error', (e) => reject(new Error('ws error')))
    ws.addEventListener('open', () => {
      resolve({
        send(method, params, sessionId) {
          return new Promise((res, rej) => {
            const myId = ++id
            pending.set(myId, { resolve: res, reject: rej })
            ws.send(JSON.stringify({ id: myId, method, params: params || {}, sessionId }))
          })
        },
        events,
        close() { try { ws.close() } catch (e) {} },
      })
    })
  })
}

module.exports = { launch, connect, sleep }
