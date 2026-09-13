const crypto=require('crypto')
const fs=require('fs')
const yamlText=fs.readFileSync('/home/lumin/.dsh/.credentials.yaml','utf8')
const m=yamlText.match(/secret:\s*([A-Za-z0-9_-]+)/)
if(!m){ console.error('no secret'); process.exit(1) }
const secret=Buffer.from(m[1],'base64url')
const authority='127.0.0.1:3080'
const name='dsh-auth-'+crypto.createHash('sha256').update(authority).digest('base64url')
const now=Date.now()
const payload={version:1,authority,issuedAt:now,expiresAt:now+7*24*3600*1000}
const body=Buffer.from(JSON.stringify(payload),'utf8').toString('base64url')
const sig=crypto.createHmac('sha256',secret).update(body).digest()
const value='v1.'+body+'.'+sig.toString('base64url')
fs.writeFileSync('/tmp/acx/bench/cookie.txt', name+'='+value)
console.log(name+'='+value)