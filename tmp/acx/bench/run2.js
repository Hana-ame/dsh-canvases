'use strict'
const { launch, connect, sleep } = require('./cdp')
const N = parseInt(process.argv[2] || '200', 10)
;(async () => {
  const b = await launch()
  const c = await connect(b.wsUrl)
  const t = await c.send('Target.createTarget', { url: 'file:///tmp/acx/bench/bench2.html' })
  const a = await c.send('Target.attachToTarget', { targetId: t.targetId, flatten: true })
  const sid = a.sessionId
  await c.send('Runtime.enable', {}, sid)
  await sleep(700)
  const run = async (expr) => {
    const r = await c.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, sid)
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 1200))
    return r.result.value
  }
  console.log('BOOT', await run(`window.__boot(${N}).then(function(r){return JSON.stringify(r)})`))
  console.log('HANDLERS?', await run(`JSON.stringify(Object.keys(window.__graphProps()||{}))`))

  // drag a FILE: find its real screen position by reading the drawn rects is hard;
  // instead drive a pointerdown on where the layout puts file 0 (agent at 40,40 -> files at 190,10..)
  console.log('DRAG-FILE', await run(`(function(){
    var p = window.__graphProps(); var el = window.__realCanvas
    var r0 = window.__R.renders()
    var t0 = performance.now()
    p.onPointerDown({ pointerType:'mouse', button:0, clientX: 214, clientY: 32, pointerId:1, currentTarget: el, metaKey:false, ctrlKey:false, shiftKey:false })
    for (var f=1; f<=60; f++) p.onPointerMove({ clientX: 214+f*2, clientY: 32+f, pointerId:1, currentTarget: el, preventDefault: function(){} })
    p.onPointerUp({ clientX: 334, clientY: 92, pointerId:1, currentTarget: el })
    var ms = performance.now()-t0
    return JSON.stringify({ totalMs: ms, perMoveMs: ms/61, componentRenders: window.__R.renders()-r0 })
  })()`))

  // hover sweep across the file grid: this is the suspicious path (setHoverFile per move)
  console.log('HOVER-SWEEP', await run(`(function(){
    var p = window.__graphProps(); var el = window.__realCanvas
    var r0 = window.__R.renders()
    var t0 = performance.now()
    for (var i=0;i<120;i++){
      p.onPointerMove({ clientX: 214 + (i%6)*212, clientY: 32 + (i%6)*52, pointerId:1, currentTarget: el, preventDefault: function(){} })
    }
    var ms = performance.now()-t0
    return JSON.stringify({ totalMs: ms, perMoveMs: ms/120, componentRenders: window.__R.renders()-r0 })
  })()`))

  // a direct full redraw cost with the real 2d context
  console.log('DRAW', await run(`(function(){
    var el = window.__realCanvas; var g = el.getContext('2d')
    var cv = window.__graphProps()
    // count paint ops during one forced redraw by timing the whole drawGraph via a resize
    var t0 = performance.now()
    for (var i=0;i<10;i++){ cv.onWheel({ deltaY: (i%2? -1:1)*100, clientX: 100, clientY:100 }) }
    return JSON.stringify({ ten: performance.now()-t0 })
  })()`))
  c.close(); b.proc.kill('SIGKILL')
})().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
