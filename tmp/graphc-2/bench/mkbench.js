'use strict'
// Build a bench page that runs the REAL client source in a REAL browser with a REAL canvas.
const fs = require('fs')
const src = fs.readFileSync('/tmp/acx/v21.client.js', 'utf8')

const harness = `
const h = null
function makeReact(){
  const hookStore = new WeakMap(); const hookStack = []; let renders = 0
  function topFrame(){ return hookStack[hookStack.length-1] }
  return {
    React: {
      createElement: function(type, props){
        const children = Array.prototype.slice.call(arguments, 2)
        if (typeof type === 'function') {
          renders += 1
          const p = {}
          if (props) for (const k in props) p[k] = props[k]
          if (children.length > 0) p.children = children
          let cells = hookStore.get(type)
          if (cells === undefined) { cells = []; hookStore.set(type, cells) }
          hookStack.push({ cells: cells, i: 0 })
          try { return type(p) } finally { hookStack.pop() }
        }
        const node = { type: type, props: props || {}, children: children }
        if (node.props.ref && typeof node.props.ref === 'object' && 'current' in node.props.ref) {
          node.props.ref.current = window.__realCanvas
        }
        return node
      },
      useState: function(init){ const f=topFrame(); const i=f.i++; if(!(i in f.cells)) f.cells[i]= typeof init==='function'?init():init; const cells=f.cells; return [cells[i], function(v){ cells[i]= typeof v==='function'?v(cells[i]):v }] },
      useRef: function(init){ const f=topFrame(); const i=f.i++; if(!(i in f.cells)) f.cells[i]={current: typeof init==='function'?init():init}; return f.cells[i] },
      useEffect: function(fn){ if(typeof fn==='function') fn() },
      useMemo: function(fn){ return typeof fn==='function'?fn():undefined },
      useCallback: function(fn){ return fn },
    },
    renderCount: function(){ return renders },
  }
}
async function boot(fileCount){
  let cv = document.getElementById('real')
  window.__realCanvas = cv
  const R = makeReact(); const React = R.React
  const registered = {}
  const ctx = {
    get: function(name){
      if (name === 'slots') return { inject: function(n,cb){ if(typeof cb==='function') cb() }, register: function(spec, render){ registered[spec.name]=render } }
      if (name === 'timer') return { timeout: function(a){ return typeof a==='function'?function(){}:new Promise(function(){}) }, interval: function(){ return function(){} } }
      if (name === 'uiWorkspace') return { listDirectory: function(){ return Promise.resolve({home:'/tmp'}) }, pickDirectory: function(){ return Promise.resolve(null) } }
      if (name === 'sessions') return { open: function(){}, binding: function(){ return null } }
      if (name === 'layout') return { selectPanel: function(){} }
      return undefined
    },
    effect: function(fn){ if(typeof fn==='function') fn(); return function(){} },
    on: function(){ return function(){} },
  }
  const entries = []
  for (let i=0;i<fileCount;i++) entries.push({ path:'/tmp/ws/a1/dir'+Math.floor(i/40)+'/file-'+i+'.ts', name:'file-'+i+'.ts', rel:'dir'+Math.floor(i/40)+'/file-'+i+'.ts', type:'file', size: 100+i, depth: 2 })
  const calls = {}
  const host = { call: function(method, args){
    calls[method]=(calls[method]||0)+1
    if (method==='canvas-sessions') return Promise.resolve({ ok:true, items:[{id:'sess-1',cwd:'/tmp/ws/a1',live:true,title:'T',createdAt:1,origin:'user'}] })
    if (method==='canvas-list-files') return Promise.resolve({ ok:true, truncated:false, entries: entries })
    if (method==='canvas-presets') return Promise.resolve({ ok:true, items:[{id:'p1',name:'P1'}] })
    if (method==='canvas-read-session') return Promise.resolve({ ok:true, messages: [] })
    return Promise.resolve({ ok:false, error:'unmocked '+method })
  } }
  const styles = { insert: function(){ return function(){} } }
  const hostWrap = { call: host.call }
  const doc = { createElement: function(t){ return document.createElement(t) }, body: document.body }
  const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor
  const factory = new AsyncFunction('React','ctx','host','styles','harness','window','document','localStorage','Blob','URL','setTimeout','console','ResizeObserver','requestAnimationFrame', ${JSON.stringify(src)})
  const plugin = await factory(React, ctx, hostWrap, styles, {}, window, doc, window.localStorage, window.Blob, window.URL, window.setTimeout, console, window.ResizeObserver, window.requestAnimationFrame)
  plugin.apply(ctx)
  let tree = registered.main()
  await new Promise(function(r){ setTimeout(r, 120) })
  tree = registered.main()
  window.__tree = tree
  window.__calls = calls
  window.__entries = entries
  return { tree, calls }
}
window.__boot = boot
`

fs.writeFileSync('/tmp/acx/bench/bench.html', `<!doctype html>
<html><head><meta charset="utf-8"><style>
body{margin:0;background:#111;color:#eee;font:12px sans-serif}
#wrap{position:relative;width:1280px;height:800px;overflow:hidden}
canvas#real{position:absolute;inset:0;width:100%;height:100%;display:block}
</style></head><body>
<div id="wrap"><canvas id="real" width="1280" height="800"></canvas></div>
<script>${harness}</script>
</body></html>`)
console.log('bench.html written')
