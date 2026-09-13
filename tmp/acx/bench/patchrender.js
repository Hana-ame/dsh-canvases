const fs=require('fs')
const p='/tmp/acx/bench/bench4.html'
let s=fs.readFileSync(p,'utf8')
const needle='  plugin.apply(ctx)'
if(s.indexOf(needle)<0){ console.log('needle-not-found'); process.exit(1) }
s=s.replace(needle, '  window.__render=function(){return registered.main()};\n  plugin.apply(ctx)')
fs.writeFileSync(p,s)
console.log('patched', s.indexOf('window.__render'))