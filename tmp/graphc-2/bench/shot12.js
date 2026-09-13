'use strict'
const http=require('http'), fs=require('fs')
function getJSON(u){return new Promise(function(res,rej){http.get(u,function(r){var b='';r.on('data',function(c){b+=c});r.on('end',function(){try{res(JSON.parse(b))}catch(e){rej(e)}})}).on('error',rej)})}
const sleep=function(ms){return new Promise(function(r){setTimeout(r,ms)})}
const cookie=fs.readFileSync('/tmp/acx/bench/cookie.txt','utf8').trim()
const eq=cookie.indexOf('='); const cname=cookie.slice(0,eq), cval=cookie.slice(eq+1)
async function main(){
  const ver=await getJSON('http://127.0.0.1:9333/json/version')
  const ws=new WebSocket(ver.webSocketDebuggerUrl); let id=0; const pending=new Map()
  ws.addEventListener('message',function(ev){var m=JSON.parse(ev.data); if(m.id&&pending.has(m.id)){var p=pending.get(m.id);pending.delete(m.id);if(m.error)p.reject(new Error(JSON.stringify(m.error)));else p.resolve(m.result)}})
  await new Promise(function(res,rej){ws.addEventListener('open',res);ws.addEventListener('error',rej)})
  function send(method,params,sessionId){return new Promise(function(res,rej){var myId=++id;pending.set(myId,{resolve:res,reject:rej});ws.send(JSON.stringify({id:myId,method:method,params:params||{},sessionId:sessionId}))})}
  const t=await send('Target.createTarget',{url:'about:blank'})
  const a=await send('Target.attachToTarget',{targetId:t.targetId,flatten:true}); const sid=a.sessionId
  await send('Runtime.enable',{},sid); await send('Page.enable',{},sid); await send('Network.enable',{},sid)
  await send('Network.setCookie',{name:cname,value:cval,url:'http://127.0.0.1:3080/',path:'/'},sid)
  const seed="try{localStorage.setItem('agent-canvas/v1',JSON.stringify({version:1,workspace:'/tmp/perfws',dock:true,mode:'file',positions:{},savedAt:1,agents:[{id:'agent-1',name:'Perf',mission:'',sessionId:'none',cwd:'/tmp/perfws',x:40,y:40,color:'#6366f1',tag:'create'}]}))}catch(e){}"
  await send('Page.addScriptToEvaluateOnNewDocument',{source:seed},sid)
  await send('Page.navigate',{url:'http://127.0.0.1:3080/'},sid)
  await sleep(6000)
  async function ev(e){var r=await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true},sid);if(r.exceptionDetails)return 'EXC '+JSON.stringify(r.exceptionDetails).slice(0,300);return r.result.value}
  // click the Agent Canvas panellist item
  var click=await ev("(function(){var els=Array.prototype.slice.call(document.querySelectorAll('button,a,div,span,li'));var cands=els.filter(function(e){return (e.textContent||'').trim()==='Agent Canvas'});if(!cands.length) return 'not-found';var el=cands[cands.length-1];el.click();return 'clicked '+cands.length})()")
  await sleep(5000)
  var probe=await ev("JSON.stringify({root:document.querySelectorAll('.acx-root').length,graph:document.querySelectorAll('.acx-graph').length,perf:document.querySelectorAll('.acx-perf').length,legend:(document.querySelector('.acx-legend')||{}).textContent||null})")
  // toggle perf panel
  var ptoggle=await ev("(function(){var bs=Array.prototype.slice.call(document.querySelectorAll('button'));var b=bs.filter(function(x){return (x.getAttribute('title')||'').indexOf('性能监测')>=0})[0];if(!b)return 'no-perf-btn';b.click();return 'toggled'})()")
  await sleep(1500)
  var perf1=await ev("(document.querySelector('.acx-perf')||{}).textContent||'NO-PANEL'")
  await sleep(4000)
  var perf2=await ev("(document.querySelector('.acx-perf')||{}).textContent||'NO-PANEL'")
  console.log(JSON.stringify({click:click, probe:probe, ptoggle:ptoggle, perf1:perf1, perf2:perf2},null,1))
  fs.writeFileSync('/tmp/acx/bench/gui-perf.json', JSON.stringify({probe:probe,perf1:perf1,perf2:perf2},null,1))
  await send('Target.closeTarget',{targetId:t.targetId}); ws.close()
}
main().catch(function(e){console.error('FAIL',e.message);process.exit(1)})
