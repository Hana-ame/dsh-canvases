const fs=require('fs')
const p='/tmp/acx/bench/bench4.html'
let s=fs.readFileSync(p,'utf8')
const old="if(name==='timer') return { timeout:function(a){ return (typeof a==='function'?function(){}:new Promise(function(){})) }, interval:function(){ return function(){} } }"
const neu="if(name==='timer') return { timeout:function(fn,ms){ if(typeof fn==='function') setTimeout(fn,(ms||0)); return function(){} }, interval:function(){ return function(){} } }"
if(s.indexOf(old)<0){ console.log('TIMER-NEEDLE-MISSING'); process.exit(1) }
s=s.split(old).join(neu)
fs.writeFileSync(p,s)
console.log('timer patched', s.indexOf('setTimeout(fn'))