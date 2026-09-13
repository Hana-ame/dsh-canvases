const { launch, connect, sleep } = require('./cdp')
;(async () => {
  const b = await launch()
  const c = await connect(b.wsUrl)
  const t = await c.send('Target.createTarget', { url: 'file:///tmp/acx/bench/bench3.html' })
  const a = await c.send('Target.attachToTarget', { targetId: t.targetId, flatten: true })
  const sid = a.sessionId
  await c.send('Runtime.enable', {}, sid)
  await c.send('Log.enable', {}, sid)
  await sleep(1000)
  const r = await c.send('Runtime.evaluate', { expression: "typeof window.__boot + ' | ' + (typeof window.__bootErr)", returnByValue: true }, sid)
  console.log('typeof:', r.result.value)
  for (const ev of c.events) {
    if (ev.method === 'Runtime.exceptionThrown') console.log('EXC:', JSON.stringify(ev.params.exceptionDetails).slice(0,600))
    if (ev.method === 'Log.entryAdded') console.log('LOG:', ev.params.entry.level, String(ev.params.entry.text).slice(0,400))
  }
  c.close(); b.proc.kill('SIGKILL')
})()
