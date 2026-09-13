'use strict'
const http=require('http')
function getJSON(u){return new Promise(function(res,rej){http.get(u,function(r){var b='';r.on('data',function(c){b+=c});r.on('end',function(){try{res(JSON.parse(b))}catch(e){rej(e)}})}).on('error',rej)})}
const sleep=function(ms){return new Promise(function(r){setTimeout(r,ms)})}
async function main(){
  const ver=await getJSON('http://127.0.0.1:9333/json/version')
  const ws=new WebSocket(ver.webSocketDebuggerUrl); let id=0; const pending=new Map(); const errs=[]
  ws.addEventListener('message',function(ev){var m=JSON.parse(ev.data); if(m.id&&pending.has(m.id)){var p=pending.get(m.id);pending.delete(m.id);if(m.error)p.reject(new Error(JSON.stringify(m.error)));else p.resolve(m.result)} else if(m.method==='Runtime.exceptionThrown'){errs.push(String((m.params.exceptionDetails.exception&&m.params.exceptionDetails.exception.description)||m.params.exceptionDetails.text).slice(0,300))}})
  await new Promise(function(res,rej){ws.addEventListener('open',res);ws.addEventListener('error',rej)})
  function send(method,params,sessionId){return new Promise(function(res,rej){var myId=++id;pending.set(myId,{resolve:res,reject:rej});ws.send(JSON.stringify({id:myId,method:method,params:params||{},sessionId:sessionId}))})}
  const t=await send('Target.createTarget',{url:'about:blank'})
  const a=await send('Target.attachToTarget',{targetId:t.targetId,flatten:true}); const sid=a.sessionId
  await send('Runtime.enable',{},sid); await send('Page.enable',{},sid)
  async function ev(e){var r=await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true},sid);if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails).slice(0,500));return r.result.value}
  await send('Page.navigate',{url:'file:///tmp/acx/bench/bench4.html'},sid)
  await sleep(700)
  const tree = [
    {path:'/tmp/ws/a1',name:'a1',rel:'',type:'directory',size:null,depth:0},
    {path:'/tmp/ws/a1/a.ts',name:'a.ts',rel:'a.ts',type:'file',size:10,depth:1},
    {path:'/tmp/ws/a1/b.md',name:'b.md',rel:'b.md',type:'file',size:20,depth:1},
    {path:'/tmp/ws/a1/sub',name:'sub',rel:'sub',type:'directory',size:null,depth:1},
    {path:'/tmp/ws/a1/sub/c.ts',name:'c.ts',rel:'sub/c.ts',type:'file',size:30,depth:2}
  ]
  await ev("window.__TREE="+JSON.stringify(tree)+"; window.__boot()")
  await sleep(600)
  var calls=await ev("JSON.stringify(window.__calls)")
  var treeLen=await ev("String(window.__TREE.length)")
  var t2=await ev("(function(){try{return JSON.stringify(window.__tree).length}catch(e){return 'ERR '+e.message}})()")
  console.log(JSON.stringify({calls:JSON.parse(calls), treeLen:treeLen, treeJsonLen:t2, exceptions:errs}))
  await send('Target.closeTarget',{targetId:t.targetId}); ws.close()
}
main().catch(function(e){console.error('FAIL',e.message);process.exit(1)})
