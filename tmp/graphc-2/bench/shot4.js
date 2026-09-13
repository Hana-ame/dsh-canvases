'use strict'
const http = require('http')
const fs = require('fs')
const src = fs.readFileSync('/tmp/acx/v21.client.js', 'utf8')

const harness = [
  "localStorage.setItem('agent-canvas/v1', JSON.stringify({ version:1, workspace:'/tmp/ws', dock:true, mode:'file', positions:{}, savedAt:1, agents:[{id:'agent-1',name:'A1',mission:'do things',sessionId:'sess-1',cwd:'/tmp/ws/a1',x:40,y:40,color:'#6366f1',tag:'create'}] }))",
  "function makeReact(){",
  "  var hookStore = new WeakMap(); var hookStack = []; var renders = 0; var perType = {}",
  "  function topFrame(){ return hookStack[hookStack.length-1] }",
  "  return { renders:function(){return renders}, React:{",
  "    createElement: function(type, props){",
  "      var children = Array.prototype.slice.call(arguments,2)",
  "      if (typeof type === 'function'){",
  "        renders++; var nm = type.name || 'anon'; perType[nm]=(perType[nm]||0)+1",
  "        var p={}; if(props) for(var k in props) p[k]=props[k]; if(children.length>0) p.children=children",
  "        var cells=hookStore.get(type); if(cells===undefined){cells=[];hookStore.set(type,cells)}",
  "        hookStack.push({cells:cells,i:0})",
  "        try { return type(p) } finally { hookStack.pop() }",
  "      }",
  "      var node={type:type,props:props||{},children:children}",
  "      if(node.props.ref && typeof node.props.ref==='object' && 'current' in node.props.ref){ node.props.ref.current = window.__realCanvas }",
  "      return node",
  "    },",
  "    useState: function(init){ var f=topFrame(); var i=f.i++; if(!(i in f.cells)) f.cells[i]= (typeof init==='function'?init():init); var cells=f.cells; return [cells[i], function(v){ cells[i]= (typeof v==='function'?v(cells[i]):v) }] },",
  "    useRef: function(init){ var f=topFrame(); var i=f.i++; if(!(i in f.cells)) f.cells[i]={current:(typeof init==='function'?init():init)}; return f.cells[i] },",
  "    useEffect: function(fn){ if(typeof fn==='function') fn() },",
  "    useMemo: function(fn, deps){ var f=topFrame(); var i=f.i++; var cell=f.cells[i]; if(cell===undefined){ var v=fn(); f.cells[i]={deps:deps,value:v}; return v } var changed=false; if(!deps||!cell.deps||cell.deps.length!==deps.length){changed=true} else { for(var k=0;k<deps.length;k++){ if(deps[k]!==cell.deps[k]){changed=true;break} } } if(changed){ cell.deps=deps; cell.value=fn() } return cell.value },",
  "    useCallback: function(fn){ return fn }",
  "  }}",
  "}",
  "function collect(node,out){ if(!node||typeof node!=='object') return out; if(Array.isArray(node)){for(var i=0;i<node.length;i++)collect(node[i],out);return out} out.push(node); var ch=node.children; if(Array.isArray(ch)) for(var i=0;i<ch.length;i++) collect(ch[i],out); return out }",
  "window.__collect = collect",
  "window.__graphProps = function(){ var all=collect(window.__tree,[]); for(var i=0;i<all.length;i++) if(all[i].props && all[i].props.className==='acx-graph') return all[i].props; return null }",
  "var TREE = [",
  "  {path:'/tmp/ws/a1',name:'a1',rel:'',type:'directory',size:null,depth:0},",
  "  {path:'/tmp/ws/a1/root.ts',name:'root.ts',rel:'root.ts',type:'file',size:120,depth:1},",
  "  {path:'/tmp/ws/a1/README.md',name:'README.md',rel:'README.md',type:'file',size:220,depth:1},",
  "  {path:'/tmp/ws/a1/sub',name:'sub',rel:'sub',type:'directory',size:null,depth:1},",
  "  {path:'/tmp/ws/a1/sub/s1.ts',name:'s1.ts',rel:'sub/s1.ts',type:'file',size:130,depth:2},",
  "  {path:'/tmp/ws/a1/sub/s2.md',name:'s2.md',rel:'sub/s2.md',type:'file',size:230,depth:2},",
  "  {path:'/tmp/ws/a1/sub/s3.ts',name:'s3.ts',rel:'sub/s3.ts',type:'file',size:140,depth:2},",
  "  {path:'/tmp/ws/a1/pkg',name:'pkg',rel:'pkg',type:'directory',size:null,depth:1},",
  "  {path:'/tmp/ws/a1/pkg/inner',name:'inner',rel:'pkg/inner',type:'directory',size:null,depth:2},",
  "  {path:'/tmp/ws/a1/pkg/inner/x.ts',name:'x.ts',rel:'pkg/inner/x.ts',type:'file',size:150,depth:3},",
  "  {path:'/tmp/ws/a1/pkg/y.ts',name:'y.ts',rel:'pkg/y.ts',type:'file',size:160,depth:2}",
  "];",
  "window.__tree = null",
  "async function boot(){",
  "  window.__realCanvas = document.getElementById('real')",
  "  var R = makeReact(); var React = R.React; window.__R = R",
  "  var registered = {}",
  "  var ctx = { get: function(name){",
  "    if(name==='slots') return { inject:function(n,cb){ if(typeof cb==='function') cb() }, register:function(spec,render){ registered[spec.name]=render } }",
  "    if(name==='timer') return { timeout:function(a){ return (typeof a==='function'?function(){}:new Promise(function(){})) }, interval:function(){ return function(){} } }",
  "    if(name==='uiWorkspace') return { listDirectory:function(){ return Promise.resolve({home:'/tmp'}) }, pickDirectory:function(){ return Promise.resolve(null) } }",
  "    if(name==='sessions') return { open:function(){}, binding:function(){ return null } }",
  "    if(name==='layout') return { selectPanel:function(){} }",
  "    return undefined",
  "  }, effect:function(fn){ if(typeof fn==='function') fn(); return function(){} }, on:function(){ return function(){} } }",
  "  var calls={}",
  "  var host={ call:function(method,args){ calls[method]=(calls[method]||0)+1;",
  "    if(method==='canvas-sessions') return Promise.resolve({ok:true,items:[{id:'sess-1',cwd:'/tmp/ws/a1',live:true,title:'T',createdAt:1,origin:'user'}]})",
  "    if(method==='canvas-list-files') return Promise.resolve({ok:true,truncated:false,entries:TREE})",
  "    if(method==='canvas-presets') return Promise.resolve({ok:true,items:[{id:'p1',name:'P1'}]})",
  "    if(method==='canvas-read-session') return Promise.resolve({ok:true,messages:[]})",
  "    if(method==='canvas-read-text') return Promise.resolve({ok:true,text:'# Title notes',truncated:false})",
  "    return Promise.resolve({ok:false,error:'unmocked '+method}) } }",
  "  var styles={insert:function(){ return function(){} }}",
  "  var doc={createElement:function(t){ return document.createElement(t) },body:document.body}",
  "  var AsyncFunction=Object.getPrototypeOf(async function(){}).constructor",
  "  var factory=new AsyncFunction('React','ctx','host','styles','harness','window','document','localStorage','Blob','URL','setTimeout','console','ResizeObserver','requestAnimationFrame'," + JSON.stringify(src) + ")",
  "  var plugin=await factory(React,ctx,host,styles,{},window,doc,window.localStorage,window.Blob,window.URL,window.setTimeout,console,window.ResizeObserver,window.requestAnimationFrame)",
  "  plugin.apply(ctx)",
  "  var tree=registered.main()",
  "  await new Promise(function(r){ setTimeout(r,200) })",
  "  tree=registered.main()",
  "  window.__tree=tree; window.__calls=calls",
  "  return { calls:calls, renders:R.renders() }",
  "}",
  "window.__boot = boot"
].join('\n')

const html = '<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#111} #wrap{position:relative;width:1280px;height:800px;overflow:hidden} canvas#real{position:absolute;inset:0;width:100%;height:100%;display:block}</style></head><body><div id="wrap"><canvas id="real" width="1280" height="800"></canvas></div><script>' + harness + '</script></body></html>'
fs.writeFileSync('/tmp/acx/bench/bench4.html', html)

function getJSON(url){ return new Promise(function(resolve,reject){ http.get(url,function(res){ var b=''; res.on('data',function(c){b+=c}); res.on('end',function(){ try{resolve(JSON.parse(b))}catch(e){reject(e)} }) }).on('error',reject) }) }
const sleep = function(ms){ return new Promise(function(r){ setTimeout(r,ms) }) }

async function main(){
  const ver = await getJSON('http://127.0.0.1:9333/json/version')
  const ws = new WebSocket(ver.webSocketDebuggerUrl)
  let id=0; const pending=new Map(); const errs=[]
  ws.addEventListener('message', function(ev){ var m=JSON.parse(ev.data); if(m.id&&pending.has(m.id)){ var p=pending.get(m.id); pending.delete(m.id); if(m.error) p.reject(new Error(JSON.stringify(m.error))); else p.resolve(m.result) } else if(m.method==='Runtime.exceptionThrown'){ errs.push(String(m.params.exceptionDetails.exception&&m.params.exceptionDetails.exception.description||m.params.exceptionDetails.text).slice(0,400)) } })
  await new Promise(function(res,rej){ ws.addEventListener('open',res); ws.addEventListener('error',rej) })
  function send(method,params,sessionId){ return new Promise(function(res,rej){ var myId=++id; pending.set(myId,{resolve:res,reject:rej}); ws.send(JSON.stringify({id:myId,method:method,params:params||{},sessionId:sessionId})) }) }
  const t = await send('Target.createTarget',{url:'file:///tmp/acx/bench/bench4.html'})
  const a = await send('Target.attachToTarget',{targetId:t.targetId,flatten:true})
  const sid=a.sessionId
  await send('Runtime.enable',{},sid)
  await send('Page.enable',{},sid)
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false},sid)
  await sleep(900)
  const ev=async function(expr){ var r=await send('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true},sid); if(r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0,800)); return r.result.value }
  var bootRes
  try { bootRes = await ev("window.__boot().then(function(r){return JSON.stringify(r)})") } catch(e){ bootRes = 'ERR '+e.message }
  await sleep(500)
  var props = await ev("(function(){ var p=window.__graphProps(); if(!p) return 'no-graph-props'; var before=window.__realCanvas.getContext('2d'); if(p.onWheel) p.onWheel({deltaY:-1,clientX:400,clientY:400,preventDefault:function(){}}); return 'ok' })()")
  await sleep(400)
  var shot = await send('Page.captureScreenshot',{format:'png'},sid)
  fs.writeFileSync('/tmp/acx/bench/shot4.png', Buffer.from(shot.data,'base64'))
  var calls = await ev("JSON.stringify(window.__calls)")
  console.log(JSON.stringify({ boot:bootRes, wheel:props, calls:calls, exceptions:errs, pngBytes: fs.statSync('/tmp/acx/bench/shot4.png').size }, null, 1))
  await send('Target.closeTarget',{targetId:t.targetId})
  ws.close()
}
main().catch(function(e){ console.error('FAIL', e.message); process.exit(1) })
