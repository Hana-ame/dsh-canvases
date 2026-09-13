const fs=require('fs')
const p='/tmp/acx/bench/shot4.js'
let s=fs.readFileSync(p,'utf8')
const i=s.indexOf("canvas-read-text")
const a=s.indexOf("text:'", i)
const b=s.indexOf("',truncated:false", a)
s = s.slice(0,a) + "text:'# Title notes'" + s.slice(b+1)
fs.writeFileSync(p,s)
console.log('patched', a, b, JSON.stringify(s.slice(a,a+40)))