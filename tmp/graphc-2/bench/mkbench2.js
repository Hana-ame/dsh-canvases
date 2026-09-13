'use strict'
const fs = require('fs')
const src = fs.readFileSync('/tmp/acx/v21.client.js', 'utf8')

const harness = `
function makeReact(){
  const hookStore = new WeakMap(); const hookStack = []; let renders = 0; const perType = {}
  function topFrame(){ return hookStack[hookStack.length-1] }
  return {
    renders: function(){ return renders },
    perType: function(){ return perType },
    React: {
      createElement: function(type, props){
        const children = Array.prototype.slice.call(arguments, 2)
        if (typeof type === 'function') {
          renders += 1
          const nm = type.name || 'anon'
          perType[nm] = (perType[nm]||0)+1
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
  }
}
async function boot(fileCount){
  window.__realCanvas = document.getElementById('real')
  const R = makeReact(); const React = R.React
  window.__R = R
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
  // files laid out in rows inside the viewport so hover hits them
  const entries = []
  const perRow = 6, colW = 212, rowH = 52, originX = 210, originY = 40
  for (let i=0;i<fileCount;i++){
    const col = Math.floor(i/perRow), row = i%perRow
    entries.push({ path:'/tmp/ws/a1/f'+i+'.ts', name:'f'+i+'.ts', rel:'f'+i+'.ts', type:'file', size: 100+i, depth: 1, __x: originX+col*colW, __y: originY+row*rowH })
  }
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
  const doc = { createElement: function(t){ return document.createElement(t) }, body: document.body }
  const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor
  const factory = new AsyncFunction('React','ctx','host','styles','harness','window','document','localStorage','Blob','URL','setTimeout','console','ResizeObserver','requestAnimationFrame', ${JSON.stringify(src)})
  const plugin = await factory(React, ctx, host, styles, {}, window, doc, window.localStorage, window.Blob, window.URL, window.setTimeout, console, window.ResizeObserver, window.requestAnimationFrame)
  plugin.apply(ctx)
  let tree = registered.main()
  await new Promise(function(r){ setTimeout(r, 150) })
  tree = registered.main()
  window.__tree = tree
  window.__calls = calls
  window.__entries = entries
  return { calls: calls, renders: R.renders() }
}
window.__boot = boot
function collect(node, out){ if(!node||typeof node!=='object') return out; if(Array.isArray(node)){for(var i=0;i<node.length;i++)collect(node[i],out);return out} out.push(node); var ch=node.children; if(Array.isArray(ch)) for(var i=0;i<ch.length;i++) collect(ch[i],out); return out }
window.__collect = collect
window.__graphProps = function(){ var all = collect(window.__tree, []); for (var i=0;i<all.length;i++) if (all[i].props && all[i].props.className === 'acx-graph') return all[i].props; return null }
`

fs.writeFileSync('/tmp/acx/bench/bench2.html', `<!doctype html>
<html><head><meta charset="utf-8"><style>
body{margin:0;background:#111;color:#eee;font:12px sans-serif}
#wrap{position:relative;width:1280px;height:800px;overflow:hidden}
canvas#real{position:absolute;inset:0;width:100%;height:100%;display:block}
</style></head><body>
<div id="wrap"><canvas id="real" width="1280" height="800"></canvas></div>
<script>
// seed canvas cache BEFORE the plugin module reads it
localStorage.setItem('agent-canvas/v1', JSON.stringify({
  version:1, workspace:'/tmp/ws', dock:true, mode:'file', positions:{}, savedAt:1,
  agents:[{id:'agent-1',name:'A1',mission:'do things',sessionId:'sess-1',cwd:'/tmp/ws/a1',x:40,y:40,color:'#6366f1',tag:'create'}]
}))
</script>
<script>${harness}</script>
</body></html>`)
console.log('bench2.html written', fs.statSync('/tmp/acx/bench/bench2.html').size)
