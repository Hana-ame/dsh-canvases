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
  const out=[]
  for (const N of [300,1200,3000]) {
    await send('Page.navigate',{url:'file:///tmp/acx/bench/bench4.html'},sid)
    await sleep(700)
    await ev("(function(){\n  window.__ops=[]; window.__tf=null;\n  var P=CanvasRenderingContext2D.prototype;\n  function hook(n,rec){var o=P[n];P[n]=function(){try{rec.apply(this,arguments)}catch(e){} return o.apply(this,arguments)}}\n  hook('roundRect',function(x,y,w,h){try{var m=this.getTransform();window.__tf={a:m.a,e:m.e,f:m.f}}catch(e){} window.__ops.push(['rr',Math.round(x),Math.round(y),Math.round(w),Math.round(h)])});\n  hook('fillText',function(s,x,y){window.__ops.push(['ft',String(s),Math.round(x),Math.round(y)])});\n  window.__makeTree=function(n){\n    var entries=[{path:'/tmp/ws/a1',name:'a1',rel:'',type:'directory',size:null,depth:0}];\n    var D=10,S=4;\n    for(var d=0;d<D;d++){ entries.push({path:'/tmp/ws/a1/d'+d,name:'d'+d,rel:'d'+d,type:'directory',size:null,depth:1});\n      for(var s=0;s<S;s++){ entries.push({path:'/tmp/ws/a1/d'+d+'/s'+s,name:'s'+s,rel:'d'+d+'/s'+s,type:'directory',size:null,depth:2}); } }\n    for(var i=0;i<n;i++){ var d=i%D,s=i%S; var ext=(i%4===0)?'.md':'.ts'; var rel='d'+d+'/s'+s+'/f'+i+ext; entries.push({path:'/tmp/ws/a1/'+rel,name:'f'+i+ext,rel:rel,type:'file',size:100+i,depth:3}); }\n    return entries;\n  };\n  window.__collectNodes=function(){ return window.__collect(window.__tree,[]) };\n  window.__perfText=function(){ var all=window.__collectNodes(); var p=null; for(var i=0;i<all.length;i++){ if(all[i]&&all[i].props&&all[i].props.className==='acx-perf'){p=all[i];break} } if(!p) return 'NO-PANEL'; var o=[]; function txt(x){ if(x==null)return; if(typeof x==='string'){o.push(x);return} if(Array.isArray(x)){for(var j=0;j<x.length;j++)txt(x[j]);return} if(x.children)txt(x.children) } txt(p); return o.join(' | ') };\n  window.__togglePerf=function(){ var all=window.__collectNodes(); var b=null; for(var i=0;i<all.length;i++){ var n=all[i]; if(n&&n.type==='button'&&n.props&&n.props.title&&n.props.title.indexOf('性能监测')>=0){b=n;break} } if(!b) return 'NO-BTN'; try{b.props.onClick()}catch(e){return 'ERR '+e.message} if(window.__render) window.__render(); return 'ok' };\n  window.__fakeEl={ getBoundingClientRect:function(){return {left:0,top:0,width:1280,height:800}}, style:{}, dataset:{}, setPointerCapture:function(){}, releasePointerCapture:function(){}, focus:function(){} };\n  return 'setup-ok';\n})()")
    var boot=await ev("window.__TREE=window.__makeTree("+N+"); window.__ops=[]; window.__boot().then(function(r){return JSON.stringify(r)})")
    await sleep(300)
    // warm render cost (memo cached)
    var warm=await ev("(function(){var t0=performance.now();for(var i=0;i<10;i++)window.__tree=window.__render();var t1=performance.now();return (t1-t0)/10})()")
    // ensure perf panel on (reset counters)
    var pt=await ev("window.__perfText()")
    if(String(pt).indexOf('NO-PANEL')>=0){ await ev("window.__togglePerf()"); await ev("window.__tree=window.__render(); 'r'"); await sleep(120) }
    // force frames
    await ev("(function(){var p=window.__graphProps();for(var i=0;i<5;i++)p.onWheel({deltaY:-1,clientX:300,clientY:200,preventDefault:function(){}});return 'w'})()")
    await sleep(250)
    var perfIdle=await ev("window.__perfText()")
    // drag burst
    var drag=await ev("(function(){\n  var p=window.__graphProps();\n  function down(x,y){return p.onPointerDown({pointerType:'mouse',button:0,clientX:x,clientY:y,pointerId:1,currentTarget:window.__fakeEl,metaKey:false,ctrlKey:false,shiftKey:false})}\n  function move(x,y){return p.onPointerMove({clientX:x,clientY:y,pointerId:1,currentTarget:window.__fakeEl,preventDefault:function(){}})}\n  function up(x,y){return p.onPointerUp({clientX:x,clientY:y,pointerId:1,currentTarget:window.__fakeEl})}\n  var rects=window.__ops.filter(function(o){return o[0]==='rr'&&o[3]===200}).map(function(o){return {x:o[1],y:o[2],w:o[3],h:o[4]}});\n  if(!rects.length) return JSON.stringify({error:'no-file-rect'});\n  var r=rects[0];\n  var tf=window.__tf||{a:1,e:0,f:0}; var dpr=window.devicePixelRatio||1; var z=tf.a/dpr,vx=tf.e/dpr,vy=tf.f/dpr;\n  var fx=(r.x+100)*z+vx, fy=(r.y+22)*z+vy;\n  down(fx,fy);\n  var t0=performance.now();\n  for(var i=0;i<60;i++){ move(fx+i*3, fy+i*2); }\n  var t1=performance.now();\n  up(fx+180,fy+120);\n  return JSON.stringify({rect:r, movesMs:Math.round((t1-t0)*100)/100, fx:Math.round(fx), fy:Math.round(fy), z:z});\n})()")
    await sleep(150)
    var perfDrag=await ev("window.__perfText()")
    // commit render (includes memo recompute)
    var commitMs=await ev("(function(){var t0=performance.now();window.__tree=window.__render();var t1=performance.now();return Math.round((t1-t0)*100)/100})()")
    await sleep(200)
    var perfAfter=await ev("window.__perfText()")
    out.push({N:N, boot:JSON.parse(boot), warmRenderMs:Math.round(warm*100)/100, commitRenderMs:commitMs, drag:JSON.parse(drag), perfIdle:perfIdle, perfDrag:perfDrag, perfAfter:perfAfter})
  }
  console.log(JSON.stringify(out,null,1))
  await send('Target.closeTarget',{targetId:t.targetId}); ws.close()
}
main().catch(function(e){console.error('FAIL',e.message);process.exit(1)})
