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
  await send('Page.navigate',{url:'file:///tmp/acx/bench/bench4.html'},sid)
  await sleep(900)
  const ev=async function(e){var r=await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true},sid);if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails).slice(0,600));return r.result.value}
  await ev("(function(){ window.__ops=[]; var P=CanvasRenderingContext2D.prototype; function hook(n,rec){var o=P[n];P[n]=function(){try{rec.apply(null,arguments)}catch(e){} return o.apply(this,arguments)}} hook('roundRect',function(x,y,w,h){window.__ops.push(['rr',Math.round(x),Math.round(y),Math.round(w),Math.round(h)])}); hook('fillText',function(s,x,y){window.__ops.push(['ft',String(s),Math.round(x),Math.round(y)])}); return 'ok' })()")
  await ev("window.__boot().then(function(r){return JSON.stringify(r)})")
  await sleep(300)
  var keys = await ev("JSON.stringify(Object.keys(window.__graphProps()).filter(function(k){return k.indexOf('on')===0||k==='onPointerDown'||k==='onPointerUp'}))")
  // helper to snapshot box heights for directory boxes
  var snap = "JSON.stringify(window.__ops.filter(function(o){return o[0]==='rr'}).map(function(o){return o.slice(1)}))"
  var before = await ev(snap)
  // find the file node rect for s1.ts by label proximity: file nodes are rr with w=200 and h=44 starting around box; we know s1 label drawn at some (x,y). Use text positions.
  var txt = await ev("JSON.stringify(window.__ops.filter(function(o){return o[0]==='ft'}).map(function(o){return [o[1],o[2],o[3]]}).filter(function(o){return o[0].indexOf('s1')>=0||o[0].indexOf('sub')>=0}))")
  console.log(JSON.stringify({keys:JSON.parse(keys), before:JSON.parse(before), labels:JSON.parse(txt)}))
  await send('Target.closeTarget',{targetId:t.targetId}); ws.close()
}
main().catch(function(e){console.error('FAIL',e.message);process.exit(1)})
