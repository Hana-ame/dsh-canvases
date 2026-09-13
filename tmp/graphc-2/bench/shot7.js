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
  await ev("(function(){ window.__ops=[]; window.__tf=null; var P=CanvasRenderingContext2D.prototype; function hook(n,rec){var o=P[n];P[n]=function(){try{rec.apply(this,arguments)}catch(e){} return o.apply(this,arguments)}} hook('roundRect',function(x,y,w,h){try{var m=this.getTransform();window.__tf={a:m.a,e:m.e,f:m.f}}catch(e){} window.__ops.push(['rr',Math.round(x),Math.round(y),Math.round(w),Math.round(h)])}); hook('fillText',function(s,x,y){window.__ops.push(['ft',String(s),Math.round(x),Math.round(y)])}); return 'ok' })()")
  await ev("window.__boot().then(function(r){return JSON.stringify(r)})")
  await sleep(300)
  await ev("window.__fakeEl={ getBoundingClientRect:function(){return {left:0,top:0,width:1280,height:800}}, style:{}, dataset:{}, setPointerCapture:function(){}, releasePointerCapture:function(){}, focus:function(){} }; 'ok'")
  var res = await ev("(function(){\n  var p=window.__graphProps();\n  function down(x,y){ return p.onPointerDown({pointerType:'mouse',button:0,clientX:x,clientY:y,pointerId:1,currentTarget:window.__fakeEl,metaKey:false,ctrlKey:false,shiftKey:false}) }\n  function move(x,y){ return p.onPointerMove({clientX:x,clientY:y,pointerId:1,currentTarget:window.__fakeEl,preventDefault:function(){}}) }\n  function up(x,y){ return p.onPointerUp({clientX:x,clientY:y,pointerId:1,currentTarget:window.__fakeEl}) }\n  function rects(){ return window.__ops.filter(function(o){return o[0]==='rr'}).map(function(o){return {x:o[1],y:o[2],w:o[3],h:o[4]}}) }\n  var r0=rects();\n  var boxes0=r0.filter(function(r){return r.w===220});\n  var files0=r0.filter(function(r){return r.w===200});\n  var s1=files0.filter(function(r){return r.h===44 && r.y>=390 && r.y<420})[0];\n  if(!s1) return JSON.stringify({error:'no-s1',boxes:boxes0,files:files0});\n  var tf=window.__tf||{a:1,e:0,f:0};\n  var dpr=(window.devicePixelRatio||1);\n  var z=tf.a/dpr, vx=tf.e/dpr, vy=tf.f/dpr;\n  var gx=s1.x+100, gy=s1.y+22;\n  var fx=gx*z+vx, fy=gy*z+vy;\n  window.__ops=[];\n  down(fx,fy); move(fx+180,fy+140); up(fx+180,fy+140); try{ window.__render(); window.__render(); }catch(e){}\n  return JSON.stringify({sub0:boxes0.filter(function(r){return r.y>=360&&r.y<420})[0],s1:s1,tf:{a:tf.a,e:tf.e,f:tf.f},dpr:dpr,z:z,vx:vx,vy:vy,fx:fx,fy:fy});\n})()")
  await ev("(function(){ var p=window.__graphProps(); if(p&&p.onWheel) p.onWheel({deltaY:-1,clientX:10,clientY:10,preventDefault:function(){}}); return 'w' })()")
  await sleep(300)
  var after = await ev("JSON.stringify(window.__ops.filter(function(o){return o[0]==='rr'}).map(function(o){return {x:o[1],y:o[2],w:o[3],h:o[4]}}))")
  var setup = JSON.parse(res)
  var aft = JSON.parse(after)
  var dropped = setup.s1 ? aft.filter(function(r){return r.w===200 && r.x===setup.s1.x+180 && r.y===setup.s1.y+140}) : []
  var stillStacked = setup.s1 ? aft.filter(function(r){return r.w===200 && r.x===setup.s1.x && r.y===setup.s1.y}) : []
  console.log(JSON.stringify({ setup:setup, all:aft, dropped:dropped, stillStacked:stillStacked }, null, 1))
  await send('Target.closeTarget',{targetId:t.targetId}); ws.close()
}
main().catch(function(e){console.error('FAIL',e.message);process.exit(1)})
