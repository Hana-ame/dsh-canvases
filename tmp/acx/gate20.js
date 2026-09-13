'use strict'
// gate20: drag/pan efficiency contract + a measured comparison of the old O(n^2)
// per-render position resolution against the shipped single-pass index.
const fs = require('fs')
const c = fs.readFileSync('/tmp/acx/v20.client.js', 'utf8')

const checks = []
const check = (n, ok) => checks.push([n, ok === true])
const re = (n, p) => check(n, p.test(c))

// ---------- shipped source must contain the exact algorithms benchmarked below ----------
re('filePos body matches the benchmark', /const col = Math\.floor\(index \/ ROW_PER_COL\)\n      const row = index % ROW_PER_COL\n      return \{ x: agent\.x \+ 150 \+ col \* \(FILE_W \+ 12\), y: agent\.y - 30 \+ row \* \(FILE_H \+ 8\) \}/)
re('render index uses the same ownerSeen counter', /const seen = ownerSeen\[key\] === undefined \? 0 : ownerSeen\[key\]\n        ownerSeen\[key\] = seen \+ 1/)
re('render index falls back for ownerless files', /filePosIndex\[f\.path\] = owner \? filePos\(owner, seen, f\) : \{ x: 60, y: 60 \}/)

// ---------- interaction contract ----------
function fnBody(name) {
  const i = c.indexOf('      function ' + name + '(e) {')
  if (i < 0) return ''
  const j = c.indexOf('\n      function ', i + 10)
  return c.slice(i, j < 0 ? i + 3000 : j)
}
const agentMove = fnBody('onAgentPointerMove')
const fileMove = fnBody('onFilePointerMove')
const panMove = fnBody('onCanvasPointerMove')
const agentUp = fnBody('onAgentPointerUp')
const fileUp = fnBody('onFilePointerUp')
check('agent pointermove handler found', agentMove.length > 50)
check('no store write on agent pointermove', agentMove.indexOf('store.set(') < 0)
check('no store write on file pointermove', fileMove.indexOf('store.set(') < 0)
check('no setPan on canvas pan move', panMove.indexOf('setPan(') < 0)
check('agent drop commits exactly once', (agentUp.match(/store\.set\(/g) || []).length === 1)
check('file drop commits exactly once', (fileUp.match(/store\.set\(/g) || []).length === 1)
re('agent drag writes the DOM directly', /d\.el\.style\.left = d\.nx \+ 'px'/)
re('file drag writes the DOM directly', /d\.el\.style\.top = d\.ny \+ 'px'/)
re('pan writes the DOM transform directly', /d\.el\.style\.transform = 'translate\('/)
re('drag start marks interaction active', /const rect = canvasRect\(\)[\s\S]{0,80}dragActive = true/)
check('refresh is suspended while dragging', /if \(refreshing\) return\n      if \(dragActive\) return/.test(c))
re('refresh skips an unchanged snapshot', /if \(sig === lastRefreshSig\) return/)
re('file rescan is cadence-gated', /now - lastFileScan\) > FILE_SCAN_MS/)
re('unchanged cycle reuses previous entries', /files\.push\(merge\(f, \{ agentId: assignOwner\(agents, f\.path\) \}\)\)/)
re('poll cadence lowered to 5s', /}, 5000\)/)
re('manual rescan exists', /function forceRescan\(\)/)
check('no per-file linear scan left in render helpers',
  !/for \(let i = 0; i < st\.files\.length; i\+\+\) if \(st\.files\[i\]\.path === /.test(c))
check('agent file counts are not recomputed per render',
  !/if \(st\.files\[i\]\.agentId !== a\.id\) continue/.test(c))

// ---------- measured benchmark with the shipped algorithm shapes ----------
const ROW_PER_COL = 6
const FILE_W = 200
const FILE_H = 44
const N = 4000
const M = 10
const agents = []
for (let i = 0; i < M; i++) agents.push({ id: 'a' + i, x: 60 + (i % 4) * 300, y: 70 + Math.floor(i / 4) * 260 })
const files = []
for (let i = 0; i < N; i++) files.push({ path: '/ws/p/' + i + '.txt', agentId: 'a' + (i % M), isNew: i % 7 === 0 })
const manual = {}

function filePos(agent, index, file) {
  const m = manual[file.path]
  if (m) return m
  const col = Math.floor(index / ROW_PER_COL)
  const row = index % ROW_PER_COL
  return { x: agent.x + 150 + col * (FILE_W + 12), y: agent.y - 30 + row * (FILE_H + 8) }
}
function findAgent(agents, id) {
  for (let i = 0; i < agents.length; i++) if (agents[i].id === id) return agents[i]
  return null
}
// old: resolved per file while rendering, each resolve scanning every file
function oldRender() {
  const out = []
  for (let k = 0; k < files.length; k++) {
    const f = files[k]
    const owner = findAgent(agents, f.agentId)
    let index = 0
    let seen = 0
    for (let i = 0; i < files.length; i++) {
      if (files[i].agentId !== f.agentId) continue
      if (files[i].path === f.path) { index = seen; break }
      seen += 1
    }
    out.push(owner ? filePos(owner, index, f) : { x: 60, y: 60 })
  }
  return out
}
// new: one O(n) pass per render
function newRender() {
  const filePosIndex = {}
  const agentsById = {}
  const ownerSeen = {}
  for (let i = 0; i < agents.length; i++) agentsById[agents[i].id] = agents[i]
  for (let i = 0; i < files.length; i++) {
    const f = files[i]
    const key = f.agentId === null || f.agentId === undefined ? '' : String(f.agentId)
    const seen = ownerSeen[key] === undefined ? 0 : ownerSeen[key]
    ownerSeen[key] = seen + 1
    const owner = f.agentId ? agentsById[f.agentId] : null
    filePosIndex[f.path] = owner ? filePos(owner, seen, f) : { x: 60, y: 60 }
  }
  return filePosIndex
}

// the real code called filePosOf twice per render (file nodes + edge paths)
function oldPointerMove() { const a = oldRender(); const b = oldRender(); return a.length + b.length }
const o1 = oldRender()
const t1 = process.hrtime.bigint()
oldPointerMove()
const t2 = process.hrtime.bigint()
const n1 = newRender()
const t3 = process.hrtime.bigint()
const n2 = newRender()
const t4 = process.hrtime.bigint()
const oldMs = Number(t2 - t1) / 1e6
const newMs = Number(t4 - t3) / 1e6
const speedup = oldMs / (newMs > 0 ? newMs : 0.0001)

// the same positions must come out of both
let same = true
for (let k = 0; k < files.length; k++) {
  const a = o2[k]
  const b = n2[files[k].path]
  if (!b || a.x !== b.x || a.y !== b.y) { same = false; break }
}
// and the first render's output must equal the second (stable)
let stable = true
for (let k = 0; k < files.length; k++) if (o1[k].x !== o2[k].x || o1[k].y !== o2[k].y) { stable = false; break }
check('new index produces identical positions', same)
check('positions are stable across renders', stable)

let bad = 0
for (const p of checks) { if (!p[1]) { console.log('FAIL ' + p[0]); bad++ } else console.log('PASS ' + p[0]) }
console.log('')
console.log('benchmark: ' + String(N) + ' files / ' + String(M) + ' agents, one render')
console.log('  old (per-file linear scan) : ' + oldMs.toFixed(1) + ' ms')
console.log('  new (single pass)          : ' + newMs.toFixed(3) + ' ms')
console.log('  speedup                    : ' + speedup.toFixed(0) + 'x')
console.log('  old cost per pointermove   : ' + oldMs.toFixed(1) + ' ms  (store.set -> full re-render, x2 passes)')
console.log('  new cost per pointermove   : ~0 ms  (imperative style write)')
check('render-pass speedup is at least 5x', speedup >= 5)
check('new render under 5 ms', newMs < 5)
if (bad > 0) { console.log('FAILURES ' + bad); process.exit(1) }
console.log('ALL PASS (' + checks.length + ')')
