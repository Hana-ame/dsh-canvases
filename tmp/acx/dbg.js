const fs=require('fs')
const src=fs.readFileSync('/tmp/acx/v21.client.js','utf8')
// find the render tail and print it
const i=src.indexOf("      const perfPanel = !showPerf")
console.log(JSON.stringify(src.slice(i-200,i+120)))
console.log('---- return site ----')
const j=src.indexOf("        perfPanel,")
console.log(JSON.stringify(src.slice(j-260,j+80)))
