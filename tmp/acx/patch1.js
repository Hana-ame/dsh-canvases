const fs = require('fs')
const p = '/tmp/acx/p14.client.js'
let c = fs.readFileSync(p, 'utf8')

function rep(from, to, label) {
  const n = c.split(from).length - 1
  if (n !== 1) throw new Error(label + ': expected 1, got ' + n)
  c = c.replace(from, to)
  console.log('ok:', label)
}

const ANCHOR = 'function detectTouch() {'
const HELPERS = [
  'function canvasCacheKey() {',
  "  return 'agent-canvas/v1'",
  '}',
  'function loadCache() {',
  '  try {',
  "    if (typeof localStorage === 'undefined' || localStorage === null) return null",
  '    const raw = localStorage.getItem(canvasCacheKey())',
  '    if (typeof raw !== "string" || raw.length === 0) return null',
  '    const doc = JSON.parse(raw)',
  '    if (!doc || typeof doc !== "object") return null',
  '    return doc',
  '  } catch (e) {',
  "    console.error('[agent-canvas] cache read failed', e)",
  '    return null',
  '  }',
  '}',
  'function saveCache(snapshot) {',
  '  try {',
  "    if (typeof localStorage === 'undefined' || localStorage === null) return false",
  '    localStorage.setItem(canvasCacheKey(), JSON.stringify(snapshot))',
  '    return true',
  '  } catch (e) {',
  "    console.error('[agent-canvas] cache write failed', e)",
  '    return false',
  '  }',
  '}',
  'function clearCache() {',
  '  try {',
  "    if (typeof localStorage === 'undefined' || localStorage === null) return",
  '    localStorage.removeItem(canvasCacheKey())',
  '  } catch (e) {}',
  '}',
  ANCHOR,
].join('\n')

rep(ANCHOR, HELPERS, 'cache helpers')
fs.writeFileSync(p, c)
console.log('written')
