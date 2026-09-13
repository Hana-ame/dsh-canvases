'use strict'
const http = require('http')
const fs = require('fs')
function getJSON(url){ return new Promise(function(resolve,reject){ http.get(url,function(res){ var b=''; res.on('data',function(c){b+=c}); res.on('end',function(){ try{resolve(JSON.parse(b))}catch(e){reject(e)} }) }).on('error',reject) }) }
const sleep = function(ms){ return new Promise(function(r){ setTimeout(r,ms) }) }
async function main(){
  const ver = await getJSON('http://127.0.0.1:9333/json/version')
  const ws = new WebSocket(ver.webSocketDebuggerUrl)
  let id=0; const pending=new Map(); const errs=[]
  ws.addEventListener('message', function(ev){ var m=JSON.parse(ev.data); if(m.id&&pending.has(m.id)){ var p=pending.get(m.id); pending.delete(m.id); if(m.error) p.reject(new Error(JSON.stringify(m.error))); else p.resolve(m.result) } else if(m.method==='Runtime.exceptionThrown'){ errs.push(String((m.params.exceptionDetails.exception&&m.params.exceptionDetails.exception.description)||m.params.exceptionDetails.text).slice(0,300)) } })
  await new Promise(function(res,rej){ ws.addEventListener('open',res); ws.addEventListener('error',rej) })
  function send(method,params,sessionId){ return new Promise(function(res,rej){ var myId=++id; pending.set(myId,{resolve:res,reject:rej}); ws.send(JSON.stringify({id:myId,method:method,params:params||{},sessionId:sessionId})) }) }
  const t = await send('Target.createTarget',{url:'about:blank'})
  const a = await send('Target.attachToTarget',{targetId:t.targetId,flatten:true})
  const sid=a.sessionId
  await send('Runtime.enable',{},sid)
  await send('Page.enable',{},sid)
  await send('Page.navigate',{url:'file:///tmp/acx/bench/bench4.html'},sid)
  await sleep(900)
  const ev=async function(expr){ var r=await send('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true},sid); if(r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0,800)); return r.result.value }
  await ev("(function(){ window.__ops=[]; var P=CanvasRenderingContext2D.prototype; function hook(n,rec){ var o=P[n]; P[n]=function(){ try{ rec.apply(null,arguments) }catch(e){} return o.apply(this,arguments) } } hook('roundRect',function(x,y,w,h){ window.__ops.push(['roundRect',Math.round(x),Math.round(y),Math.round(w),Math.round(h)]) }); hook('fillText',function(s,x,y){ window.__ops.push(['fillText',String(s),Math.round(x),Math.round(y)]) }); hook('bezierCurveTo',function(){ window.__ops.push(['bezierCurveTo']) }); hook('moveTo',function(x,y){ window.__ops.push(['moveTo',Math.round(x),Math.round(y)]) }); hook('lineTo',function(x,y){ window.__ops.push(['lineTo',Math.round(x),Math.round(y)]) }); hook('arc',function(x,y,r){ window.__ops.push(['arc',Math.round(x),Math.round(y),Math.round(r)]) }); hook('clearRect',function(){ window.__ops.push(['clearRect']) }); return 'hooks' })()")
  var bootRes = await ev("window.__boot().then(function(r){return JSON.stringify(r)})")
  await sleep(400)
  await ev("(function(){ var p=window.__graphProps(); if(p&&p.onWheel) p.onWheel({deltaY:-1,clientX:400,clientY:400,preventDefault:function(){}}); return 'wheel' })()")
  await sleep(400)
  var ops = await ev("JSON.stringify(window.__ops)")
  var arr = JSON.parse(ops)
  var texts = arr.filter(function(o){return o[0]==='fillText'}).map(function(o){return o[1]})
  var uniq = Array.from(new Set(texts))
  var rr = arr.filter(function(o){return o[0]==='roundRect'})
  var be = arr.filter(function(o){return o[0]==='bezierCurveTo'})
  var arcs = arr.filter(function(o){return o[0]==='arc'})
  console.log(JSON.stringify({ boot:bootRes, exceptions:errs, totalOps:arr.length, roundRects:rr.length, bezier:be.length, arcs:arcs.length, fillTexts:texts.length, uniqueTexts:uniq, rects:rr }, null, 1))
  await send('Target.closeTarget',{targetId:t.targetId})
  ws.close()
}
main().catch(function(e){ console.error('FAIL', e.message); process.exit(1) })
