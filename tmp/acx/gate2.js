const fs = require('fs')
const c = fs.readFileSync('/tmp/acx/s15.client.js', 'utf8')
const h = fs.readFileSync('/tmp/acx/s15.host.js', 'utf8')
new Function(c)
new Function(h)

const checks = [
  ['cache key helper', /function canvasCacheKey\(\)/.test(c)],
  ['load helper', /function loadCache\(\)/.test(c)],
  ['save helper', /function saveCache\(snapshot\)/.test(c)],
  ['clear helper', /function clearCache\(\)/.test(c)],
  ['store hydrates agents', /const cachedAgents = Array\.isArray\(cached\.agents\)/.test(c)],
  ['store hydrates workspace', /typeof cached\.workspace === "string"/.test(c)],
  ['store hydrates dock', /dock: cached\.dock === true/.test(c)],
  ['positions restored', /for \(const k in cachedPositions\)/.test(c)],
  ['positions saved', /for \(const k in manual\) positions\[k\]/.test(c)],
  ['agents saved', /const agents = s\.agents\.map/.test(c)],
  ['persist subscribes', /store\.subscribe\(persistSoon\)/.test(c)],
  ['persist is throttled', /persistTimer = timer\.timeout/.test(c)],
  ['missing detection guarded', /const listOk = sessRes\.ok === true/.test(c)],
  ['missing shown in UI', /\\u4f1a\\u8bdd\\u672a\\u5728\\u5217\\u8868\\u4e2d/.test(c)],
  ['reset button clears cache', /clearCache\(\)/.test(c)],
  ['all localStorage guarded', (c.match(/typeof localStorage/g) || []).length === 3],
  // Pre-existing behaviour must survive.
  ['workspace model intact', /const roots = ws \? \[ws\] : \[\]/.test(c)],
  ['title gate intact', /args && args\.titles === true/.test(h)],
  ['refresh guard intact', /let refreshing = false/.test(c)],
  ['user message fix intact', /role: 'user', text: blocksText\(data\.content\)/.test(c + h)],
  ['3 slots intact', (c.match(/slots\.inject\(/g) || []).length === 3],
]

let bad = 0
for (const [label, ok] of checks) {
  if (!ok) bad++
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + label)
}
console.log(bad ? 'FAILURES ' + bad : 'ALL PASS')
console.log('bytes client', c.length, 'host', h.length)
