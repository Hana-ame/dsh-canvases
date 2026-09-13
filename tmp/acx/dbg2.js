const fs=require('fs')
const s=fs.readFileSync('/tmp/acx/gate22.js','utf8')
// how many toolbar buttons exist and does one contain 性能?
const i=s.indexOf("const buttons = collect(byClass(nodes, 'acx-bar')[0], [])")
console.log(s.slice(i-400,i+400))
