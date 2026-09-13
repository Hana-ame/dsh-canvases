const fs=require('fs')
const p='/tmp/acx/bench/bench4.html'
let s=fs.readFileSync(p,'utf8')
const needle='entries:TREE'
if(s.indexOf(needle)<0){ console.log('NEEDLE-MISSING'); process.exit(1) }
s=s.split(needle).join('entries:(window.__TREE||TREE)')
fs.writeFileSync(p,s)
console.log('patched', s.indexOf('window.__TREE||TREE'))