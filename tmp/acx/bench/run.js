'use strict'
const { launch, connect, sleep } = require('./cdp')
const N = parseInt(process.argv[2] || '200', 10)
;(async () => {
  const b = await launch()
  const c = await connect(b.wsUrl)
  const t = await c.send('Target.createTarget', { url: 'file:///tmp/acx/bench/bench.html' })
  const a = await c.send('Target.attachToTarget', { targetId: t.targetId, flatten: true })
  const sid = a.sessionId
  await c.send('Runtime.enable', {}, sid)
  await sleep(600)
  const run = async (expr) => {
    const r = await c.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, sid)
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 800))
    return r.result.value
  }
  const booted = await run(`window.__boot(${N}).then(function(r){ return JSON.stringify({tree: true, calls: r.calls}) })`)
  console.log('BOOT', booted)

  // Measure a real drag frame cost: pointermove handler as wired by the component.
  const res = await run(`(function(){
    var tree = window.__tree
    function collect(node, out){ if(!node||typeof node!=='object') return out; if(Array.isArray(node)){for(var i=0;i<node.length;i++)collect(node[i],out);return out} out.push(node); var ch=node.children; if(Array.isArray(ch)) for(var i=0;i<ch.length;i++) collect(ch[i],out); return out }
    var all = collect(tree, [])
    var cv = null
    for (var i=0;i<all.length;i++) if (all[i].props && all[i].props.className === 'acx-graph') cv = all[i]
    if (!cv) return JSON.stringify({ error: 'no canvas node' })
    var el = window.__realCanvas
    var handlers = cv.props
    // warm
    for (var w=0; w<3; w++) handlers.onPointerMove({ clientX: 200+w, clientY: 200, pointerId: 1, currentTarget: el, preventDefault: function(){} })
    var t0 = performance.now()
    var FRAMES = 60
    for (var f=0; f<FRAMES; f++) {
      handlers.onPointerMove({ clientX: 200+f, clientY: 200+f, pointerId: 1, currentTarget: el, preventDefault: function(){} })
    }
    var ms = performance.now() - t0
    return JSON.stringify({ handlerPmMs: ms/FRAMES, frames: FRAMES })
  })()`)
  console.log('MOVE(no drag active)', res)

  const drag = await run(`(function(){
    var tree = window.__tree
    function collect(node, out){ if(!node||typeof node!=='object') return out; if(Array.isArray(node)){for(var i=0;i<node.length;i++)collect(node[i],out);return out} out.push(node); var ch=node.children; if(Array.isArray(ch)) for(var i=0;i<ch.length;i++) collect(ch[i],out); return out }
    var all = collect(tree, [])
    var cv = null
    for (var i=0;i<all.length;i++) if (all[i].props && all[i].props.className === 'acx-graph') cv = all[i]
    var el = window.__realCanvas
    var p = cv.props
    var t0 = performance.now()
    for (var f=0; f<40; f++) {
      if (f === 0) p.onPointerDown({ pointerType:'mouse', button:0, clientX: 300, clientY: 300, pointerId: 1, currentTarget: el, metaKey:false, ctrlKey:false, shiftKey:false })
      p.onPointerMove({ clientX: 300+f*3, clientY: 300+f*2, pointerId: 1, currentTarget: el, preventDefault: function(){} })
    }
    p.onPointerUp({ clientX: 420, clientY: 380, pointerId: 1, currentTarget: el })
    return JSON.stringify({ dragTotalMs: performance.now()-t0 })
  })()`)
  console.log('DRAG', drag)
  c.close(); b.proc.kill('SIGKILL')
})().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
