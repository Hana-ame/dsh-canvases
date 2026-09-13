const fs=require('fs'),path=require('path')
function walkBFS(root,limit){
  const out=[]; const q=[{p:root,d:0}]
  while(q.length && out.length<limit){ const it=q.shift(); let list; try{ list=fs.readdirSync(it.p,{withFileTypes:true}) }catch(e){ continue }
    for(const e of list){ if(e.name==='node_modules'||e.name==='.git'||e.name==='.cache'||e.name==='dist'||e.name==='build') continue
      const cp=path.join(it.p,e.name); const isDir=e.isDirectory()
      out.push({path:cp,type:isDir?'directory':'file'})
      if(isDir && it.d+1<8) q.push({p:cp,d:it.d+1})
      if(out.length>=limit) break
    }
  }
  return out
}
let t0=Date.now(); const e=walkBFS('/tmp/perfws',4000); let t1=Date.now()
console.log('perfws entries',e.length,'walk ms',t1-t0)
// host sessions corpus
function du(dir){ let n=0,b=0; const st=[dir]; while(st.length){ const d=st.pop(); let l; try{l=fs.readdirSync(d,{withFileTypes:true})}catch(x){continue} for(const x of l){ const p=path.join(d,x.name); if(x.isDirectory()) st.push(p); else { n++; try{b+=fs.statSync(p).size}catch(y){} } } } return {n,b} }
const corp=du('/home/lumin/.dsh/sessions'); console.log('sessions files',corp.n,'bytes',corp.b)
let a0=Date.now(); let acc=0; const files=[]; (function collect(d){ let l; try{l=fs.readdirSync(d,{withFileTypes:true})}catch(x){return} for(const x of l){ const p=path.join(d,x.name); if(x.isDirectory()) collect(p); else files.push(p) } })('/home/lumin/.dsh/sessions')
for(const f of files){ try{ acc+=fs.readFileSync(f).length }catch(e){} }
let a1=Date.now(); console.log('sessions full read ms',a1-a0,'bytes',acc,'files',files.length)
