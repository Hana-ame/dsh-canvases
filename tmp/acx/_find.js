const fs = require('fs')
const p = process.argv[2]
const j = JSON.parse(fs.readFileSync(p, 'utf8'))
const needle = process.argv[3]
const out = []
function walk(o, path, depth) {
  if (depth > 8 || o == null) return
  if (typeof o === 'string') {
    let i = o.indexOf(needle)
    if (i >= 0) out.push({ path, len: o.length, at: i, head: o.slice(Math.max(0, i - 120), i + 400) })
    return
  }
  if (typeof o !== 'object') return
  for (const k of Object.keys(o)) walk(o[k], path + '.' + k, out, depth + 1)
}
walk(j, '', 0)
console.log(JSON.stringify(out, null, 1))
