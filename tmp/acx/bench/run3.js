'use strict'
const { launch, connect, sleep } = require('./cdp')
;(async () => {
  const b = await launch()
  const c = await connect(b.wsUrl)
  const t = await c.send('Target.createTarget', { url: 'file:///tmp/acx/bench/bench2.html' })
  const a = await c.send('Target.attachToTarget', { targetId: t.targetId, flatten: true })
  const sid = a.sessionId
  await c.send('Runtime.enable', {}, sid)
  await sleep(700)
  const run = async (e) => {
    const r = await c.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }, sid)
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 900))
    return r.result.value
  }
  console.log('BOOT', await run(`window.__boot(300).then(function(r){return JSON.stringify(r)})`))
  // count getComputedStyle calls during a hover sweep (this was the style-recalc source)
  console.log('HOVER+GETCOMPUTED', await run(`(function(){
    var real = window.getComputedStyle
    var n = 0
    window.getComputedStyle = function(){ n++; return real.apply(this, arguments) }
    var p = window.__graphProps(); var el = window.__realCanvas
    var r0 = window.__R.renders()
    for (var i=0;i<200;i++) p.onPointerMove({ clientX: 214+(i%6)*212, clientY: 32+(i%6)*52, pointerId:1, currentTarget: el, preventDefault: function(){} })
    var out = { getComputedStyleCalls: n, componentRenders: window.__R.renders()-r0 }
    window.getComputedStyle = real
    return JSON.stringify(out)
  })()`))
  // measure real paint cost of a redraw
  console.log('PAINT', await run(`(function(){
    var p = window.__graphProps()
    var t0 = performance.now()
    for (var i=0;i<30;i++) p.onWheel({ deltaY: (i%2?-1:1)*100, clientX: 300, clientY: 300 })
    return JSON.stringify({ thirtyZoomsMs: performance.now()-t0 })
  })()`))
  c.close(); b.proc.kill('SIGKILL')
})().catch((e)=>{console.error('FAIL',e.message);process.exit(1)})
