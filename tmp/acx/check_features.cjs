'use strict'
// Real-behavior check of the 4 requested features against the shipped bundle.
const fs = require('fs')
const src = fs.readFileSync('/tmp/acx/v21.client.js', 'utf8')

// ---- Point 4: extract the REAL hierarchy + md functions verbatim ----
const start = src.indexOf('const DIR_COL_W = FILE_W + 52')
const end = src.indexOf('function useTranscript(agent)')
const block = src.slice(start, end)
console.log('extracted block bytes:', block.length, '| contains filePos:', block.indexOf('function filePos(') >= 0)

const factory = new Function(
  'FILE_W', 'FILE_H', 'manual', 'MD_MAX_LINES', 'MD_MAX_CHARS', 'MD_FETCH_MAX',
  block + '\nreturn { filePos: filePos, mdLinesOf: mdLinesOf, isMarkdown: isMarkdown, nodeH: nodeH, depthOfRel: depthOfRel, dirOfRel: dirOfRel, MD_NODE_H: MD_NODE_H }'
)
const api = factory(200, 44, {}, 6, 4000, 12)
const agent = { x: 0, y: 0 }

const files = [
  { path: '/ws/a/f1.txt', rel: 'a/f1.txt', name: 'f1.txt', type: 'file' },
  { path: '/ws/a/f2.txt', rel: 'a/f2.txt', name: 'f2.txt', type: 'file' },
  { path: '/ws/a/f3.txt', rel: 'a/f3.txt', name: 'f3.txt', type: 'file' },
  { path: '/ws/b/g1.txt', rel: 'b/g1.txt', name: 'g1.txt', type: 'file' },
  { path: '/ws/b/g2.txt', rel: 'b/g2.txt', name: 'g2.txt', type: 'file' },
  { path: '/ws/b/g3.txt', rel: 'b/g3.txt', name: 'g3.txt', type: 'file' },
]
console.log('\n--- Point 4: folder-hierarchy layout, 2 dirs at depth 1 (index = per-owner flat counter) ---')
files.forEach(function (f, i) {
  const p = api.filePos(agent, i, f)
  console.log('  ' + f.rel.padEnd(9) + ' index=' + i + ' -> x=' + p.x + ' y=' + p.y + '  dir=' + api.dirOfRel(f.rel))
})
const xs = {}
files.forEach(function (f, i) { xs[api.filePos(agent, i, f).x] = true })
console.log('  distinct x columns:', Object.keys(xs).join(', '), ' <-- same column regardless of directory')

// ---- Point 2: md lines on node ----
const md = { name: 'README.md', type: 'file', path: '/ws/README.md', mdText: '# Title\n\nbody line\n\n```js\ncode\n```\n' }
console.log('\n--- Point 2: md content on node ---')
console.log('  isMarkdown(README.md):', api.isMarkdown(md), ' nodeH:', api.nodeH(md), '(MD_NODE_H=' + api.MD_NODE_H + ')')
console.log('  mdLinesOf while fetching (no mdText):', api.mdLinesOf({ name: 'x.md', type: 'file' }))
console.log('  mdLinesOf with text:', JSON.stringify(api.mdLinesOf(md)))

// ---- Point 2b: does the fetched md text ever reach the store snapshot? ----
const fetch = src.slice(src.indexOf('function fetchMarkdown('), src.indexOf('function assignOwner('))
console.log('  fetchMarkdown updates mdCache and calls store.set({}) ->', fetch.indexOf('mdCache[f.path] =') >= 0 && fetch.indexOf('store.set({})') >= 0)
console.log('  does it write mdText into the file objects in the store?', fetch.indexOf('f.mdText =') >= 0)

// ---- Point 1: moveRenders counter semantics ----
const idx = src.indexOf('if (PERF.moves > 0) PERF.moveRenders += 1')
console.log('\n--- Point 1: perf monitor moveRenders ---')
console.log('  line context:', JSON.stringify(src.slice(idx - 30, idx + 45).replace(/\n/g, ' | ')))
console.log('  counts once per move, or once per render-after-any-move? -> reads PERF.moves (a cumulative counter) inside the render body')
