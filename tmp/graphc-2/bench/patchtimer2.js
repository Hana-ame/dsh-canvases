const fs=require('fs')
const p='/tmp/acx/bench/bench4.html'
let s=fs.readFileSync(p,'utf8')
const bad="if(name==='timer') return { timeout:function(fn,ms){ if(typeof fn==='function') setTimeout(fn,(ms||0)); return function(){} }, interval:function(){ return function(){} } }"
const good="if(name==='timer') return { timeout:function(fn,ms){ if(typeof fn==='function'){ setTimeout(fn,(ms||0)); return function(){} } return new Promise(function(){}) }, interval:function(){ return function(){} } }"
if(s.indexOf(bad)<0){ console.log('BAD-NEEDLE-MISSING'); process.exit(1) }
s=s.split(bad).join(good)
fs.writeFileSync(p,s)
console.log('timer fixed', s.indexOf('new Promise(function(){})'), 'at', s.indexOf(good))