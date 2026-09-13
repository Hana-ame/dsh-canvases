const fs=require('fs'),path=require('path')
const root='/tmp/perfws'
fs.rmSync(root,{recursive:true,force:true}); fs.mkdirSync(root,{recursive:true})
let n=0
for(let d=0; d<10; d++){ const dd=path.join(root,'d'+d); fs.mkdirSync(dd)
  for(let s=0; s<4; s++){ const sd=path.join(dd,'s'+s); fs.mkdirSync(sd)
    for(let k=0;k<50;k++){ const ext=(k%4===0)?'.md':'.ts'; fs.writeFileSync(path.join(sd,'f'+n+ext), '# f'+n+'\nline1\nline2'+ (ext==='.ts'?'':'')); n++ }
  }
}
console.log('files',n)