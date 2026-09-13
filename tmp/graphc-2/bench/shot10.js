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
  await ev("(function(){\n  var P=CanvasRenderingContext2D.prototype;\n  function hook(n,rec){var o=P[n];P[n]=function(){try{rec.apply(this,arguments)}catch(e){} return o.apply(this,arguments)}}\n  hook('roundRect',function(x,y,w,h){try{var m=this.getTransform();window.__tf={a:m.a,e:m.e,f:m.f}}catch(e){} window.__ops.push(['rr',Math.round(x),Math.round(y),Math.round(w),Math.round(h)])});\n  window.__ops=[];\n  window.__makeTree=function(n){\n    var entries=[{path:'/tmp/ws/a1',name:'a1',rel:'',type:'directory',size:null,depth:0}];\n    var D=10,S=4;\n    for(var d=0;d<D;d++){ entries.push({path:'/tmp/ws/a1/d'+d,name:'d'+d,rel:'d'+d,type:'directory',size:null,depth:1});\n      for(var s=0;s<S;s++){ entries.push({path:'/tmp/ws/a1/d'+d+'/s'+s,name:'s'+s,rel:'d'+d+'/s'+s,type:'directory',size:null,depth:2}); } }\n    for(var i=0;i<n;i++){ var d=i%D,s=i%S; var ext=(i%4===0)?'.md':'.ts'; var rel='d'+d+'/s'+s+'/f'+i+ext; entries.push({path:'/tmp/ws/a1/'+rel,name:'f'+i+ext,rel:rel,type:'file',size:100+i,depth:3}); }\n    return entries;\n  };\n  window.__collectNodes=function(){ return window.__collect(window.__tree,[]) };\n  window.__perfText=function(){ var all=window.__collectNodes(); var p=null; for(var i=0;i<all.length;i++){ if(all[i]&&all[i].props&&all[i].props.className==='acx-perf'){p=all[i];break} } if(!p) return 'NO-PANEL'; var o=[]; function txt(x){ if(x==null)return; if(typeof x==='string'){o.push(x);return} if(Array.isArray(x)){for(var j=0;j<x.length;j++)txt(x[j]);return} if(x.children)txt(x.children) } txt(p); return o.join(' | ') };\n  window.__togglePerf=function(){ var all=window.__collectNodes(); for(var i=0;i<all.length;i++){ var n=all[i]; if(n&&n.type==='button'&&n.props&&n.props.title&&n.props.title.indexOf('性能监测')>=0){ n.props.onClick(); window.__tree=window.__render(); return 'ok' } } return 'NO-BTN' };\n  window.__clickTitle=function(t){ var all=window.__collectNodes(); for(var i=0;i<all.length;i++){ var n=all[i]; if(n&&n.type==='button'&&n.props&&n.props.title&&n.props.title.indexOf(t)>=0){ n.props.onClick(); window.__tree=window.__render(); return 'ok' } } return 'NO-BTN:'+t };\n  window.__drawOnce=function(){ window.__ops=[]; var p=window.__graphProps(); if(!p) return 'no-props'; p.onWheel({deltaY:0,clientX:0,clientY:0,preventDefault:function(){}}); return 'noop' };\n  return 'setup-ok';\n})()")
  await ev("window.__TREE=window.__makeTree(4000); window.__boot()")
  await sleep(400)
  await ev("window.__togglePerf()"); await sleep(100)
  const rows=[]
  rows.push({step:'@boot', perf:await ev("window.__perfText()")})
  for (var i=1;i<=14;i++){
    await ev("window.__clickTitle('缩小')")
    await sleep(140)
    var pt=await ev("window.__perfText()")
    rows.push({zoomOut:i, perf:String(pt)})
  }
  console.log(JSON.stringify(rows,null,1))
  await send('Target.closeTarget',{targetId:t.targetId}); ws.close()
}
main().catch(function(e){console.error('FAIL',e.message);process.exit(1)})
