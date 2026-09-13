'use strict'
const http=require('http')
function getJSON(u){return new Promise(function(res,rej){http.get(u,function(r){var b='';r.on('data',function(c){b+=c});r.on('end',function(){try{res(JSON.parse(b))}catch(e){rej(e)}})}).on('error',rej)})}
const sleep=function(ms){return new Promise(function(r){setTimeout(r,ms)})}
async function main(){
  const ver=await getJSON('http://127.0.0.1:9333/json/version')
  const ws=new WebSocket(ver.webSocketDebuggerUrl); let id=0; const pending=new Map()
  ws.addEventListener('message',function(ev){var m=JSON.parse(ev.data); if(m.id&&pending.has(m.id)){var p=pending.get(m.id);pending.delete(m.id);if(m.error)p.reject(new Error(JSON.stringify(m.error)));else p.resolve(m.result)}})
  await new Promise(function(res,rej){ws.addEventListener('open',res);ws.addEventListener('error',rej)})
  function send(method,params,sessionId){return new Promise(function(res,rej){var myId=++id;pending.set(myId,{resolve:res,reject:rej});ws.send(JSON.stringify({id:myId,method:method,params:params||{},sessionId:sessionId}))})}
  const t=await send('Target.createTarget',{url:'about:blank'})
  const a=await send('Target.attachToTarget',{targetId:t.targetId,flatten:true}); const sid=a.sessionId
  await send('Runtime.enable',{},sid); await send('Page.enable',{},sid)
  async function ev(e){var r=await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true},sid);if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails).slice(0,500));return r.result.value}
  const tree=[
    {path:'/tmp/ws/d1',name:'d1',rel:'d1',type:'directory',size:null,depth:1},
    {path:'/tmp/ws/d1/f1.ts',name:'f1.ts',rel:'d1/f1.ts',type:'file',size:11,depth:2},
    {path:'/tmp/ws/d1/f2.ts',name:'f2.ts',rel:'d1/f2.ts',type:'file',size:12,depth:2},
    {path:'/tmp/ws/top.ts',name:'top.ts',rel:'top.ts',type:'file',size:13,depth:1}
  ]
  async function scenario(name, revealed, positions){
    await send('Page.navigate',{url:'file:///tmp/acx/bench/bench4.html'},sid)
    await sleep(700)
    await ev("(function(){window.__ops=[];var P=CanvasRenderingContext2D.prototype;function hook(n,rec){var o=P[n];P[n]=function(){try{rec.apply(this,arguments)}catch(e){} return o.apply(this,arguments)}}hook('roundRect',function(){try{var m=this.getTransform();window.__tf={a:m.a,e:m.e,f:m.f}}catch(e){}window.__ops.push(['rr']) });hook('fillText',function(s,x,y){window.__ops.push(['ft',String(s)])});hook('bezierCurveTo',function(){window.__ops.push(['bez']) });return 'h'})()")
    await ev("localStorage.setItem('agent-canvas/v1', JSON.stringify({version:1,workspace:'/tmp/ws',dock:true,mode:'file',positions:"+JSON.stringify(positions)+",revealed:"+JSON.stringify(revealed)+",savedAt:1,agents:[{id:'agent-1',name:'A1',mission:'',sessionId:'sess-1',cwd:'/tmp/ws',x:80,y:90,color:'#6366f1',tag:'create'}]}))")
    await ev("window.__TREE="+JSON.stringify(tree)+"; window.__ops=[]; window.__boot()")
    await sleep(400)
    var res=await ev("(function(){var o=window.__ops;return JSON.stringify({labels:Array.from(new Set(o.filter(function(x){return x[0]==='ft'}).map(function(x){return x[1]}))),rr:o.filter(function(x){return x[0]==='rr'}).length,bez:o.filter(function(x){return x[0]==='bez'}).length})})()")
    return {name:name, r:JSON.parse(res)}
  }
  const out=[]
  out.push(await scenario('import-only (no split)', {}, {}))
  out.push(await scenario('revealed d1 + split f1', {'/tmp/ws/d1':true}, {'/tmp/ws/d1/f1.ts':{x:700,y:400}}))
  console.log(JSON.stringify(out,null,1))
  await send('Target.closeTarget',{targetId:t.targetId}); ws.close()
}
main().catch(function(e){console.error('FAIL',e.message);process.exit(1)})
