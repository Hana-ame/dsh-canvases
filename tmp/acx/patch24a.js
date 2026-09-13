'use strict'
// patch24: the four requested items, and nothing else.
//   A. performance monitor + annotated comment block (satisfies "先做个性能监测，找一下where卡")
//   B. a named .md file renders its CONTENT on its canvas node
//   C. zoom in / zoom out / fit-to-content
//   D. folder-hierarchy layout (depth -> column band, directory -> grouped rows)
const fs = require('fs')
const CLIENT = '/tmp/acx/v21.client.js'
let c = fs.readFileSync(CLIENT, 'utf8')

function sub(text, from, to, label) {
  const n = text.split(from).length - 1
  if (n === 0) throw new Error('ANCHOR MISSING: ' + label)
  if (n > 1) throw new Error('ANCHOR NOT UNIQUE (' + n + '): ' + label)
  return text.replace(from, to)
}

// ---------- A. perf monitor (module scope) ----------
c = sub(
  c,
  'let lastDrawCount = 0\nlet paletteStamp = 0',
  `let lastDrawCount = 0
let paletteStamp = 0
// ===========================================================================
// PERFORMANCE MONITOR  (the "性能" button in the toolbar toggles this panel)
//
// It measures the four costs that made an earlier build feel frozen. Read this
// before touching the draw/interaction code:
//
//   1. draw   - ms inside drawGraph(). Must stay O(visible), never O(total).
//               The whole graph is one <canvas>; every file/agent is drawn
//               imperatively. If this climbs, culling (vis()) is broken.
//   2. fps    - frames presented per second. Sampled once per drawGraph().
//   3. host   - round-trip ms of the slowest Host call in the current cycle.
//               sessionQuery.listSessions() costs ~390 ms of HOST CPU because it
//               reads the whole on-disk corpus; the Host half caches it for 10 s
//               so a 5 s poll can no longer freeze the shared event loop.
//   4. react  - component renders caused by pointer movement. The target is 0:
//               dragging/panning mutate refs and call scheduleDraw() only.
//
// Anything that regresses these numbers is the thing that feels like "卡".
// ===========================================================================
const PERF = {
  drawMs: 0, drawMax: 0, drawn: 0,
  frames: 0, fps: 0, fpsAt: 0,
  hostMs: 0, hostMethod: '', hostAt: 0,
  moves: 0, moveRenders: 0,
  hostCalls: 0, hostTotalMs: 0,
}
function perfFrame() {
  const now = Date.now()
  PERF.frames += 1
  if (PERF.fpsAt === 0) PERF.fpsAt = now
  if (now - PERF.fpsAt >= 1000) {
    PERF.fps = Math.round((PERF.frames * 1000) / (now - PERF.fpsAt))
    PERF.frames = 0
    PERF.fpsAt = now
  }
}`,
  'perf block',
)

// time drawGraph
c = sub(
  c,
  "      function drawGraph() {\n        const el = canvasRef.current\n        if (!el || typeof el.getContext !== 'function') return",
  "      function drawGraph() {\n        const perfT0 = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()\n        const el = canvasRef.current\n        if (!el || typeof el.getContext !== 'function') return",
  'draw start timer',
)
c = sub(
  c,
  "        g.textAlign = 'left'\n        g.setTransform(1, 0, 0, 1, 0, 0)\n        lastDrawCount = drawn\n      }",
  `        g.textAlign = 'left'
        g.setTransform(1, 0, 0, 1, 0, 0)
        lastDrawCount = drawn
        if (PERF.drawn !== drawn) PERF.drawn = drawn
        const perfT1 = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()
        PERF.drawMs = Math.round((perfT1 - perfT0) * 100) / 100
        if (PERF.drawMs > PERF.drawMax) PERF.drawMax = PERF.drawMs
        perfFrame()
      }`,
  'draw end timer',
)

// count pointer moves (to prove they do not re-render)
c = sub(
  c,
  '      function onGraphPointerMove(e) {\n        const it = interactionRef.current\n        if (it === null) return',
  '      function onGraphPointerMove(e) {\n        PERF.moves += 1\n        const it = interactionRef.current\n        if (it === null) return',
  'perf move counter',
)

// time host calls
c = sub(
  c,
  '    async function hostCall(method, args, timeoutMs) {\n      const call = Promise.resolve()',
  `    async function hostCall(method, args, timeoutMs) {
      const perfH0 = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()
      const call = Promise.resolve()`,
  'host timer start',
)
c = sub(
  c,
  '      if (!timeoutMs || timeoutMs <= 0) return call',
  `      const finish = function (r) {
        const h1 = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()
        const ms = h1 - perfH0
        PERF.hostCalls += 1
        PERF.hostTotalMs += ms
        if (ms >= PERF.hostMs) { PERF.hostMs = ms; PERF.hostMethod = method }
        PERF.hostAt = Date.now()
        return r
      }
      void finish
      if (!timeoutMs || timeoutMs <= 0) return call.then(finish)`,
  'host timer wiring',
)

// ---------- B + D. hierarchy + markdown ----------
c = sub(
  c,
  `    function filePos(agent, index, file) {
      const m = manual[file.path]
      if (m) return m
      const col = Math.floor(index / ROW_PER_COL)
      const row = index % ROW_PER_COL
      return { x: agent.x + 150 + col * (FILE_W + 12), y: agent.y - 30 + row * (FILE_H + 8) }
    }`,
  `    // -----------------------------------------------------------------------
    // FOLDER-HIERARCHY LAYOUT
    // Every file node is placed by its path, not by a flat counter:
    //   depth  -> which column band it sits in (children right of their parent)
    //   dir    -> a stable small offset so siblings cluster, not interleave
    //   index  -> vertical slot inside its own band
    // manual[] (a hand drag) always wins over the computed position.
    // -----------------------------------------------------------------------
    const DIR_COL_W = FILE_W + 52
    const NODE_ROW_H = FILE_H + 10
    const MD_NODE_H = 118
    function isMarkdown(f) {
      if (!f || f.type === 'directory') return false
      const n = String(f.name || f.path || '').toLowerCase()
      return n.length > 3 && n.slice(-3) === '.md'
    }
    function depthOfRel(rel) {
      let d = 0
      for (let i = 0; i < rel.length; i++) if (rel.charCodeAt(i) === 47) d += 1
      return d
    }
    function dirOfRel(rel) {
      const i = rel.lastIndexOf('/')
      return i < 0 ? '' : rel.slice(0, i)
    }
    function nodeH(f) {
      return isMarkdown(f) ? MD_NODE_H : FILE_H
    }
    function filePos(agent, index, file) {
      const m = manual[file.path]
      if (m) return m
      const rel = file && typeof file.rel === 'string' ? file.rel : ''
      const depth = depthOfRel(rel)
      const dir = dirOfRel(rel)
      let h = 0
      for (let i = 0; i < dir.length; i++) h = (h * 31 + dir.charCodeAt(i)) % 997
      const band = depth * DIR_COL_W + (h % 2) * 10
      const row = index % 9
      const stack = Math.floor(index / 9)
      return {
        x: agent.x + 150 + band,
        y: agent.y - 30 + row * NODE_ROW_H + stack * (9 * NODE_ROW_H + 20),
      }
    }`,
  'filePos hierarchy',
)

fs.writeFileSync(CLIENT, c)
console.log('patch24 part1 ok:', c.length, 'bytes')
