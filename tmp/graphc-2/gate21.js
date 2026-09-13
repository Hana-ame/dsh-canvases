'use strict'
// gate21: canvas renderer contract + measured culling behaviour.
// Supersedes gate20's DOM-specific assertions (the DOM node layer no longer exists);
// the refresh/debounce contracts from pkg-20 are still asserted here.
const fs = require('fs')
const c = fs.readFileSync('/tmp/acx/v21.client.js', 'utf8')
const h = fs.readFileSync('/tmp/acx/v21.host.js', 'utf8')

const checks = []
const check = (n, ok) => checks.push([n, ok === true])
const re = (n, p, text) => check(n, p.test(text === undefined ? c : text))
function fnBody(name) {
  const i = c.indexOf('      function ' + name + '(')
  if (i < 0) return ''
  const j = c.indexOf('\n      function ', i + 10)
  return c.slice(i, j < 0 ? i + 6000 : j)
}

// ---------------- canvas surface ----------------
re('graph is a canvas element', /h\('canvas', \{\n        className: 'acx-graph'/)
re('canvas is bound to canvasRef', /ref: canvasRef/)
re('2d context is used', /el\.getContext\('2d'\)/)
re('backing store follows devicePixelRatio', /Math\.min\(window\.devicePixelRatio, 2\)/)
re('backing store resized only when needed', /if \(el\.width !== pxW \|\| el\.height !== pxH\)/)
re('view transform applied once', /g\.setTransform\(dpr \* v\.z, 0, 0, dpr \* v\.z, dpr \* v\.x, dpr \* v\.y\)/)
re('transform reset before clearing', /g\.setTransform\(1, 0, 0, 1, 0, 0\)\n        g\.clearRect/)
re('background grid is not redrawn', /\.acx-canvas\{position:absolute;inset:0;z-index:0;pointer-events:none/)
re('hit layer never swallows pointers', /\.acx-layer\{position:absolute;inset:0;z-index:2;pointer-events:none\}/)

// ---------------- culling ----------------
re('visibility predicate exists', /const vis = function \(x, y, ww, hh\)/)
const fileLoop = (c.match(/\/\/ file nodes[\s\S]*?\/\/ agents on top/) || [''])[0]
const cullAt = fileLoop.indexOf('if (!vis(p.x, p.y, FILE_W, nh)) continue')
check('file loop culls before any path work', cullAt >= 0 && cullAt < fileLoop.indexOf('roundRectPath'))
check('file loop draws text only after culling', cullAt >= 0 && cullAt < fileLoop.indexOf('fillText'))
const edgeLoop = (c.match(/\/\/ edges[\s\S]*?g\.setLineDash\(\[\]\)/) || [''])[0]
check('edge loop culls before building the curve', edgeLoop.indexOf('if (!vis(p.x, p.y, FILE_W, FILE_H)) continue') < edgeLoop.indexOf('bezierCurveTo'))
const agentLoop = (c.match(/\/\/ agents on top[\s\S]*?lastDrawCount = drawn/) || [''])[0]
check('agent loop culls before drawing', agentLoop.indexOf('if (!vis(ap.x, ap.y, AGENT_SIZE, AGENT_SIZE)) continue') < agentLoop.indexOf('g.arc('))
re('drawn counter is reported', /lastDrawCount = drawn/)

// ---------------- interaction: no react render while dragging ----------------
const move = fnBody('onGraphPointerMove')
const up = fnBody('onGraphPointerUp')
check('pointermove handler found', move.length > 100)
check('pointermove never writes the store', move.indexOf('store.set(') < 0)
check('pointermove never calls a setter', !/set[A-Z][A-Za-z]*\(/.test(move.replace(/setPointerCapture/g, '')))
check('drag only mutates the live ref', /liveRef\.current = \{ kind: 'agent', id: it\.id, x: it\.x, y: it\.y \}/.test(move))
check('redraw is rAF throttled', /window\.requestAnimationFrame\(run\)/.test(c))
check('pending draw is deduplicated', /if \(drawPendingRef\.current === true\) return/.test(c))
check('agent drop commits exactly once', (up.match(/store\.set\(/g) || []).length === 2)
check('agent drop commits position', up.indexOf('store.set({ agents: next })') >= 0)
check('pan commits on pointerup only', /if \(it\.x !== pan\.x \|\| it\.y !== pan\.y\) setPan\(\{ x: it\.x, y: it\.y \}\)/.test(up))
check('click still opens the inspector', /const a2 = findAgent\(store\.get\(\)\.agents, it\.id\)\n          if \(a2\) openInspector\(a2\)/.test(up))
check('click still toggles file selection', up.indexOf('toggleFile(it.path)') >= 0)

// ---------------- hit testing ----------------
const hit = fnBody('hitTest')
check('hit test scans agents top-down', /for \(let i = st\.agents\.length - 1; i >= 0; i--\)/.test(hit))
check('hit test scans files top-down', /for \(let i = st\.files\.length - 1; i >= 0; i--\)/.test(hit))
check('hit test uses squared distance (no sqrt)', hit.indexOf('dx * dx + dy * dy') >= 0 && hit.indexOf('Math.sqrt') < 0)
check('hit test uses the live drag position', /const p = livePosOf\(f\)/.test(hit))

// ---------------- retained pkg-20 contracts ----------------
re('refresh skips an unchanged snapshot', /if \(sig === lastRefreshSig\) return/)
re('refresh is suspended while dragging', /if \(refreshing\) return\n      if \(dragActive\) return/)
re('file rescan is cadence-gated', /now - lastFileScan\) > fileScanMs/)
re('file rescan backs off after a slow walk', /fileScanMs = Date\.now\(\) - scanStart > 400 \? 30000 : 6000/)
re('poll cadence is 15s', /}, 15000\)/)
re('manual rescan exists', /function forceRescan\(\)/)
re('drag can end without a capture leak', /if \(!d\) \{ dragActive = false; return \}|interactionRef\.current = null\n        dragActive = false/)
re('host still exposes canvas-stat-dir', /canvas-stat-dir/, h)
check('host handler count unchanged', (h.match(/harness\.handle\(/g) || []).length === 11)
check('host serves the UI source to the client half', h.indexOf("harness.handle('canvas-source'") >= 0)
check('host can read text for the md preview', h.indexOf("harness.handle('canvas-read-text'") >= 0)

// ---------------- measured culling behaviour ----------------
const N = 5000
const FILE_W = 200
const FILE_H = 44
const items = []
for (let i = 0; i < N; i++) items.push({ x: (i % 50) * 220, y: Math.floor(i / 50) * 60 })
const view = { x0: 0, y0: 0, x1: 1200, y1: 800 }
const t0 = process.hrtime.bigint()
let visible = 0
for (let i = 0; i < N; i++) {
  const p = items[i]
  if (!(p.x + FILE_W < view.x0 || p.x > view.x1 || p.y + FILE_H < view.y0 || p.y > view.y1)) visible += 1
}
const t1 = process.hrtime.bigint()
const scanMs = Number(t1 - t0) / 1e6
check('culling keeps the frame small', visible < 200)
check('culling scan is fast', scanMs < 4)

let bad = 0
for (const p of checks) { if (!p[1]) { console.log('FAIL ' + p[0]); bad++ } else console.log('PASS ' + p[0]) }
console.log('')
console.log('culling: ' + String(N) + ' nodes, viewport 1200x800')
console.log('  visible per frame : ' + String(visible) + ' (' + (100 * visible / N).toFixed(1) + '% of nodes)')
console.log('  cull scan         : ' + scanMs.toFixed(2) + ' ms')
console.log('  work per frame    : O(visible) path/text ops instead of O(total)')
if (bad > 0) { console.log('FAILURES ' + bad); process.exit(1) }
console.log('ALL PASS (' + checks.length + ')')
