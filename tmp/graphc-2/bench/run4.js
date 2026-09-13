'use strict'
const { launch, connect, sleep } = require('./cdp')
;(async () => {
  const b = await launch()
  const c = await connect(b.wsUrl)
  const t = await c.send('Target.createTarget', { url: 'file:///tmp/acx/bench/bench3.html' })
  const a = await c.send('Target.attachToTarget', { targetId: t.targetId, flatten: true })
  const sid = a.sessionId
  await c.send('Runtime.enable', {}, sid)
  const logs = []
  c.events.length = 0
  await sleep(900)
  const run = async (e) => {
    const r = await c.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }, sid)
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0,900))
    return r.result.value
  }
  console.log('BOOT', await run(`window.__boot(40).then(function(r){return JSON.stringify(r)})`))
  await sleep(300)
  // Count what drawGraph actually paints, with md nodes present
  console.log('PAINT', await run(`(function(){
    var el = window.__realCanvas; var g = el.getContext('2d')
    var counts = {}
    ;['fillText','roundRect','arc','bezierCurveTo','clearRect'].forEach(function(k){
      var orig = g[k].bind(g); counts[k]=0
      g[k] = function(){ counts[k]++; return orig.apply(null, arguments) }
    })
    var p = window.__graphProps()
    p.onPointerMove({ clientX: 300, clientY: 300, pointerId: 1, currentTarget: el, preventDefault: function(){} })
    // force a redraw by zooming
    p.onWheel({ deltaY: -100, clientX: 300, clientY: 300 })
    var wait = new Promise(function(r){ window.requestAnimationFrame(function(){ window.requestAnimationFrame(r) }) })
    return wait.then(function(){ return JSON.stringify(counts) })
  })()`))
  console.log('HOST CALLS', await run(`JSON.stringify(window.__calls)`))
  c.close(); b.proc.kill('SIGKILL')
})().catch((e)=>{console.error('FAIL',e.message);process.exit(1)})
