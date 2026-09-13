// Exercise the shipped export builders against a realistic canvas state.
const src = require('fs').readFileSync('/tmp/acx/s17.client.js', 'utf8')
const pick = (name) => {
  const start = src.indexOf('function ' + name + '(')
  if (start < 0) throw new Error('missing ' + name)
  // Walk braces to the matching close.
  let depth = 0, i = src.indexOf('{', start)
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') depth++
    else if (src[j] === '}') { depth--; if (depth === 0) return src.slice(start, j + 1) }
  }
  throw new Error('unbalanced ' + name)
}
const initialsStub = 'function initials(n){const s=String(n||"").trim();return s.slice(0,2).toUpperCase()}'
const firstLineStub = 'function firstLine(t,m){return String(t||"").split("\\n")[0].slice(0,m)}'
const code = [
  initialsStub,
  firstLineStub,
  pick('buildExportDoc'),
  pick('buildMarkdown'),
  pick('drawPng'),
  'return { buildExportDoc, buildMarkdown, drawPng }',
].join('\n')
const api = new Function(code)()

const st = {
  workspace: '/home/lumin/proj',
  mode: 'file',
  agents: [
    { id: 'agent-1', name: 'build', mission: 'build the thing\nsecond line', sessionId: 'session-a', cwd: '/home/lumin/proj/build-1', x: 60, y: 70, color: '#6366f1', pending: false, error: null },
    { id: 'agent-2', name: 'test', mission: '', sessionId: null, cwd: null, x: 360, y: 70, color: '#0ea5e9', pending: true, error: 'boom' },
  ],
  files: [
    { path: '/home/lumin/proj/build-1/main.ts', name: 'main.ts', rel: 'build-1/main.ts', type: 'file', size: 128, isNew: true, agentId: 'agent-1' },
    { path: '/home/lumin/proj/build-1/util.ts', name: 'util.ts', rel: 'build-1/util.ts', type: 'file', size: 64, isNew: false, agentId: 'agent-1' },
    { path: '/home/lumin/proj/readme.md', name: 'readme.md', rel: 'readme.md', type: 'file', size: 32, isNew: false, agentId: null },
  ],
}

const doc = api.buildExportDoc(st)
console.log('JSON counts:', JSON.stringify(doc.counts))
console.log('JSON agents:', doc.agents.length, 'edges:', doc.edges.length)
console.log('agent1 files captured:', doc.agents[0].files.length)
console.log('agent2 error captured:', doc.agents[1].error, 'pending:', doc.agents[1].pending)
console.log('kind/version:', doc.kind, doc.version, 'workspace:', doc.workspace)

const md = api.buildMarkdown(st)
console.log('--- markdown ---')
console.log(md)
console.log('--- md checks ---')
console.log('has agent1 heading:', md.includes('### build'))
console.log('mission first line only:', md.includes('- 使命: build the thing'), !md.includes('second line'))
console.log('lists owned files:', md.includes('`/home/lumin/proj/build-1/main.ts`'))
console.log('marks new:', /main\.ts` \(new\)/.test(md))

// drawPng needs a canvas; give it a minimal stub and confirm it draws without throwing.
let calls = 0
const ctx = new Proxy({}, { get: (t, k) => {
  if (k === 'canvas') return {}
  return (...a) => { calls++; return k === 'getContext' ? ctx : undefined }
}, set: () => true })
globalThis.document = { createElement: () => ({ getContext: () => ctx, width: 0, height: 0, toDataURL: () => 'data:image/png;base64,AA' }) }
const posOf = (f) => ({ x: 300, y: 100 })
const canvas = api.drawPng(st, posOf, 56)
console.log('drawPng returned canvas:', canvas !== null, 'draw calls:', calls > 10 ? 'many' : calls)
console.log('OK')
