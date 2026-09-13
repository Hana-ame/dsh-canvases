const fs = require('fs')
const h = fs.readFileSync('/tmp/acx/final.host.js', 'utf8')
const c = fs.readFileSync('/tmp/acx/final.client.js', 'utf8')
new Function(h); new Function(c)

const checks = [
  ['host title gate', /args && args\.titles === true/.test(h)],
  ['host title bounded', /Math\.min\(args\.titleLimit, 40\)/.test(h) && /ids\.slice\(0, titleLimit\)/.test(h)],
  ['host B1 user content', /role: 'user', text: blocksText\(data\.content\)/.test(h)],
  ['host B2 three keys', (h.match(/key: 's' \+ String\(ev\.seq\)/g) || []).length === 3],
  ['client guard', /let refreshing = false/.test(c)],
  ['client self-reschedule', /then\(schedule, schedule\)/.test(c)],
  ['client no fixed refresh', !/interval\(tick, 3000\)/.test(c)],
  ['client bounded titles x2', (c.match(/titleLimit: 20/g) || []).length === 2],
  ['client main slot', /slots\.inject\('main'/.test(c)],
  ['client sidebar slot', /sidebar\.panellist/.test(c)],
  ['client cordis card', /tool\.view\.cordis/.test(c)],
  ['client CanvasApp', /function CanvasApp/.test(c)],
  ['client ChatDock', /function ChatDock/.test(c)],
  ['create deadline 8s', /8000/.test(c)],
  ['create adopt on timeout', /adoptExisting/.test(c)],
]

let bad = 0
for (const [label, ok] of checks) {
  if (!ok) bad++
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + label)
}
console.log(bad ? 'FAILURES ' + bad : 'ALL PASS')
console.log('host bytes', h.length, 'client bytes', c.length)
