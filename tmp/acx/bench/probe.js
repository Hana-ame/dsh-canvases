'use strict'
const { launch, connect, sleep } = require('./cdp')
;(async () => {
  const b = await launch()
  const c = await connect(b.wsUrl)
  const t = await c.send('Target.createTarget', { url: 'data:text/html,<html><body><canvas id=c width=800 height=600></canvas></body></html>' })
  const a = await c.send('Target.attachToTarget', { targetId: t.targetId, flatten: true })
  const sid = a.sessionId
  await c.send('Runtime.enable', {}, sid)
  const r = await c.send('Runtime.evaluate', {
    expression: `(function(){var cv=document.getElementById('c');var g=cv.getContext('2d');var t0=performance.now();for(var i=0;i<2000;i++){g.fillRect(i%800,0,10,10)};return JSON.stringify({dpr:devicePixelRatio, ms: performance.now()-t0})})()`,
    returnByValue: true,
  }, sid)
  console.log('RESULT', r.result.value)
  c.close(); b.proc.kill('SIGKILL')
})().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
