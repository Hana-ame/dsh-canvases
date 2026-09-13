// Simulate the cache round-trip the canvas performs, using a fake localStorage.
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, v),
  removeItem: (k) => store.delete(k),
}

// Pull the three helpers out of the real source so we test shipped code, not a copy.
const fs = require('fs')
const src = fs.readFileSync('/tmp/acx/p14.client.js', 'utf8')
const start = src.indexOf('function canvasCacheKey()')
const end = src.indexOf('function detectTouch()')
const helpers = src.slice(start, end)
const factory = new Function(helpers + '\nreturn { canvasCacheKey, loadCache, saveCache, clearCache }')
const api = factory()

console.log('empty read ->', api.loadCache())

const snapshot = {
  version: 1,
  workspace: '/home/lumin/proj',
  dock: true,
  agents: [
    { id: 'agent-1', name: 'build', mission: 'build it', sessionId: 'session-a', cwd: '/home/lumin/proj/build-1', x: 60, y: 70, color: '#6366f1', tag: 'create' },
  ],
  positions: { '/home/lumin/proj/src/main.ts': { x: 300, y: 120 } },
  savedAt: Date.now(),
}
console.log('save ->', api.saveCache(snapshot))
const back = api.loadCache()
console.log('round-trip workspace:', back.workspace)
console.log('round-trip agents:', back.agents.length, back.agents[0].sessionId)
console.log('round-trip position:', JSON.stringify(back.positions['/home/lumin/proj/src/main.ts']))
console.log('key used:', api.canvasCacheKey())

api.clearCache()
console.log('after clear ->', api.loadCache())

// Corrupt payload must not throw.
store.set(api.canvasCacheKey(), '{not json')
console.log('corrupt read ->', api.loadCache())
console.log('OK')
