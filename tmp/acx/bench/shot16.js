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
  await send('Page.navigate',{url:'file:///tmp/acx/bench/bench4.html'},sid)
  await sleep(700)
  await ev("(function(){window.__ops=[];window.__tf=null;var P=CanvasRenderingContext2D.prototype;function hook(n,rec){var o=P[n];P[n]=function(){try{rec.apply(this,arguments)}catch(e){} return o.apply(this,arguments)}}hook('roundRect',function(x,y,w,h){try{var m=this.getTransform();window.__tf={a:m.a,e:m.e,f:m.f}}catch(e){}window.__ops.push(['rr',Math.round(x),Math.round(y),Math.round(w),Math.round(h)])});hook('fillText',function(s,x,y){window.__ops.push(['ft',String(s)])});hook('stroke',function(){window.__ops.push(['stroke',String(this.strokeStyle),this.lineWidth])});hook('bezierCurveTo',function(){window.__ops.push(['bez',String(this.strokeStyle)])});return 'hooks'})()")
  const tree = [
    {path:'/tmp/ws/a1',name:'a1',rel:'',type:'directory',size:null,depth:0},
    {path:'/tmp/ws/a1/a.ts',name:'a.ts',rel:'a.ts',type:'file',size:10,depth:1},
    {path:'/tmp/ws/a1/b.md',name:'b.md',rel:'b.md',type:'file',size:20,depth:1},
    {path:'/tmp/ws/a1/sub',name:'sub',rel:'sub',type:'directory',size:null,depth:1},
    {path:'/tmp/ws/a1/sub/c.ts',name:'c.ts',rel:'sub/c.ts',type:'file',size:30,depth:2},
    {path:'/tmp/ws/other',name:'other',rel:'other',type:'directory',size:null,depth:1},
    {path:'/tmp/ws/other/loose.ts',name:'loose.ts',rel:'other/loose.ts',type:'file',size:40,depth:2}
  ]
  await ev("window.__TREE="+JSON.stringify(tree)+"; window.__ops=[]; window.__boot()")
  await sleep(400)
  var labels = await ev("JSON.stringify(Array.from(new Set(window.__ops.filter(function(o){return o[0]==='ft'}).map(function(o){return o[1]}))))")
  var looseDrawn = JSON.parse(labels).some(function(s){return String(s).indexOf('loose')>=0})
  // hover the agent: agent at seeded (40,40), size 56
  var move = await ev("(function(){var tf=window.__tf||{a:1,e:0,f:0};var z=tf.a,vx=tf.e,vy=tf.f;var p=window.__graphProps();window.__fakeEl={getBoundingClientRect:function(){return{left:0,top:0,width:1280,height:800}}};p.onPointerMove({clientX:(40+28)*z+vx,clientY:(40+28)*z+vy,pointerId:1,currentTarget:window.__fakeEl,preventDefault:function(){}});return JSON.stringify({z:z,vx:vx,vy:vy})})()")
  await sleep(120)
  await ev("window.__tree=window.__render()")
  await ev("window.__ops=[]")
  await ev("(function(){var p=window.__graphProps();p.onWheel({deltaY:-1,clientX:20,clientY:20,preventDefault:function(){}});return 'draw'})()")
  await sleep(200)
  var hover = await ev("(function(){var o=window.__ops;var accent=o.filter(function(x){return (x[0]==='stroke'||x[0]==='bez')&&String(x[1]).indexOf('4d6bfe')>=0}).length;var allStroke=o.filter(function(x){return x[0]==='stroke'}).length;var bez=o.filter(function(x){return x[0]==='bez'}).length;return JSON.stringify({accent:accent,allStroke:allStroke,bez:bez})})()")
  console.log(JSON.stringify({labels:JSON.parse(labels), looseDrawn:looseDrawn, move:JSON.parse(move), hoverCounts:JSON.parse(hover)},null,1))
  await send('Target.closeTarget',{targetId:t.targetId}); ws.close()
}
main().catch(function(e){console.error('FAIL',e.message);process.exit(1)})
