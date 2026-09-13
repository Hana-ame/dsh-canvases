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
  await send('Page.navigate',{url:'http://127.0.0.1:3080/'},sid)
  await sleep(6000)
  async function ev(e){var r=await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true},sid);if(r.exceptionDetails)return 'EXC '+JSON.stringify(r.exceptionDetails).slice(0,300);return r.result.value}
  var txt=await ev("document.body.innerText.slice(0,1800)")
  var btns=await ev("JSON.stringify(Array.prototype.slice.call(document.querySelectorAll('button')).map(function(b){return (b.getAttribute('title')||'')+'|'+(b.textContent||'').trim().slice(0,24)}).slice(0,60))")
  var canvasEls=await ev("JSON.stringify(Array.prototype.slice.call(document.querySelectorAll('*')).filter(function(e){return /canvas/i.test(e.textContent||'')&&e.children.length===0}).map(function(e){return e.tagName+':'+(e.textContent||'').trim().slice(0,30)}).slice(0,20))")
  var classes=await ev("JSON.stringify(Array.prototype.slice.call(document.querySelectorAll('[class]')).map(function(e){return e.className}).filter(function(c){return typeof c==='string'&&/panel|side|slot/i.test(c)}).slice(0,30))")
  console.log('--- innerText ---\n'+txt+'\n--- buttons ---\n'+btns+'\n--- canvas texts ---\n'+canvasEls+'\n--- classes ---\n'+classes)
  await send('Target.closeTarget',{targetId:t.targetId}); ws.close()
}
main().catch(function(e){console.error('FAIL',e.message);process.exit(1)})
