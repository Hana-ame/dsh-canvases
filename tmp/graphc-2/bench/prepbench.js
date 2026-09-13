const fs=require('fs')
const p='/tmp/acx/bench/bench4.html'
let s=fs.readFileSync(p,'utf8')
function rep(from,to){ if(s.indexOf(from)<0){ console.log('MISS:',from.slice(0,50)); return } s=s.split(from).join(to) }
rep('entries:TREE','entries:(window.__TREE||TREE)')
rep('  plugin.apply(ctx)','  window.__render=function(){return registered.main()};\n  plugin.apply(ctx)')
rep("if(name==='timer') return { timeout:function(a){ return (typeof a==='function'?function(){}:new Promise(function(){})) }, interval:function(){ return function(){} } }",
    "if(name==='timer') return { timeout:function(fn,ms){ if(typeof fn==='function'){ setTimeout(fn,(ms||0)); return function(){} } return new Promise(function(){} ) }, interval:function(){ return function(){} } }")
fs.writeFileSync(p,s)
console.log('prep done bytes', s.length)