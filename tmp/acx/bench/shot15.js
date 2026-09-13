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
  await sleep(6500)
  async function ev(e){var r=await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true},sid);if(r.exceptionDetails)return 'EXC '+JSON.stringify(r.exceptionDetails).slice(0,300);return r.result.value}
  // open the Cordis Plugin panel
  var c=await ev("(function(){var bs=Array.prototype.slice.call(document.querySelectorAll('button'));var b=bs.filter(function(x){return /Cordis Plugin/.test(x.textContent||'')})[0];if(!b)return 'no-cordis-btn';b.click();return 'clicked'})()")
  await sleep(1500)
  var dump=await ev("(function(){var btns=Array.prototype.slice.call(document.querySelectorAll('button'));var info=btns.map(function(b){return {t:(b.textContent||'').trim().slice(0,20), title:(b.getAttribute('title')||'').slice(0,30)}}).filter(function(x){return x.t||x.title});var panel=(document.querySelector('.dsh-cordis, [class*=cordis]')||{}).textContent;return JSON.stringify({click:'ok',btns:info.slice(-40),panel:(panel||'').slice(0,800)})})()")
  console.log(dump)
  await send('Target.closeTarget',{targetId:t.targetId}); ws.close()
}
main().catch(function(e){console.error('FAIL',e.message);process.exit(1)})
