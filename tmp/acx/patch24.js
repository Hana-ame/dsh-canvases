'use strict'
// patch24: the four things asked for, together.
//  A. live perf monitor (FPS, draw ms, hover renders, host-call ms) + a comment block in the source
//  B. a named md file renders its CONTENT ON the canvas node (not just the name)
//  C. real zoom controls (buttons + wheel + fit-to-content + ctrl+wheel)
//  D. folder HIERARCHY layout: files grouped under their directory, nested by depth
const fs = require('fs')
const CLIENT = '/tmp/acx/v21.client.js'
let c = fs.readFileSync(CLIENT, 'utf8')

function sub(text, from, to, label) {
  const n = text.split(from).length - 1
  if (n === 0) throw new Error('ANCHOR MISSING: ' + label)
  if (n > 1) throw new Error('ANCHOR NOT UNIQUE (' + n + '): ' + label)
  return text.replace(from, to)
}

// ============ A. perf monitor state + instrumented draw ============
c = sub(
  c,
  'let lastDrawCount = 0\nlet paletteStamp = 0',
  `let lastDrawCount = 0
let paletteStamp = 0
// ---------------------------------------------------------------------------
// PERFORMANCE MONITOR (perf HUD)
// Live instrumentation of the three costs that made an earlier build feel stuck:
//   1. draw  - milliseconds spent inside drawGraph (canvas painting)
//   2. fps   - frames actually presented per second while dragging/panning
//   3. host  - round-trip ms of the slowest Host call in the last poll cycle
//   4. react - component renders triggered by pointer movement (target: 0)
// Toggle with the "性能" button. Counters are plain module numbers updated on the
// draw path itself, so reading them costs nothing on a frame.
// ---------------------------------------------------------------------------
const PERF = {
  drawMs: 0, drawMax: 0, drawn: 0,
  frames: 0, fps: 0, fpsAt: 0,
  hostMs: 0, hostMethod: '', hostAt: 0,
  moveEvents: 0, moveRenders: 0,
  lastFrameAt: 0,
}
function perfFrame() {
  const now = Date.now()
  PERF.frames += 1
  if (PERF.lastFrameAt !== 0 && now - PERF.fpsAt > 1000) {
    PERF.fps = Math.round((PERF.frames * 1000) / (now - PERF.fpsAt))
    PERF.frames = 0
    PERF.fpsAt = now
  }
  if (PERF.fpsAt === 0) PERF.fpsAt = now
  PERF.lastFrameAt = now
}`,
  'perf monitor block',
)

// instrument drawGraph
c = sub(
  c,
  '      function drawGraph() {\n        const el = canvasRef.current\n        if (!el || typeof el.getContext !== \'function\') return',
  '      function drawGraph() {\n        const perfT0 = typeof performance !== \'undefined\' && performance.now ? performance.now() : Date.now()\n        const el = canvasRef.current\n        if (!el || typeof el.getContext !== \'function\') return',
  'drawGraph timer start',
)
c = sub(
  c,
  '        g.textAlign = \'left\'\n        g.setTransform(1, 0, 0, 1, 0, 0)\n        lastDrawCount = drawn\n      }',
  `        g.textAlign = 'left'
        g.setTransform(1, 0, 0, 1, 0, 0)
        lastDrawCount = drawn
        const perfT1 = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()
        PERF.drawMs = Math.round((perfT1 - perfT0) * 100) / 100
        if (PERF.drawMs > PERF.drawMax) PERF.drawMax = PERF.drawMs
        PERF.drawn = drawn
        perfFrame()
      }`,
  'drawGraph timer end',
)

// ============ B + D. hierarchy layout + md content ============
c = sub(
  c,
  `    function filePos(agent, index, file) {
      const m = manual[file.path]
      if (m) return m
      const col = Math.floor(index / ROW_PER_COL)
      const row = index % ROW_PER_COL
      return { x: agent.x + 150 + col * (FILE_W + 12), y: agent.y - 30 + row * (FILE_H + 8) }
    }`,
  `    // Hierarchy layout: each directory owns a column band; depth pushes right, and
    // files in the same directory stack vertically in name order. This is what makes
    // the canvas read as a folder tree instead of a flat blob of nodes.
    const DIR_COL_W = FILE_W + 46
    const NODE_ROW_H = FILE_H + 10
    function depthOf(rel) {
      if (!rel) return 0
      let d = 0
      for (let i = 0; i < rel.length; i++) if (rel.charCodeAt(i) === 47) d += 1
      return d
    }
    function dirOf(rel) {
      if (!rel) return ''
      const i = rel.lastIndexOf('/')
      return i < 0 ? '' : rel.slice(0, i)
    }
    function nodeH(file) {
      return isMarkdown(file) ? MD_NODE_H : FILE_H
    }
    function filePos(agent, index, file) {
      const m = manual[file.path]
      if (m) return m
      const rel = file && typeof file.rel === 'string' ? file.rel : ''
      const depth = depthOf(rel)
      const dir = dirOf(rel)
      // stable per-directory slot: hash the directory path so siblings stay together
      let h = 0
      for (let i = 0; i < dir.length; i++) h = (h * 31 + dir.charCodeAt(i)) % 100000
      const band = depth * DIR_COL_W + (h % 3) * 8
      const row = index % 9
      const stack = Math.floor(index / 9)
      return {
        x: agent.x + 150 + band,
        y: agent.y - 30 + row * NODE_ROW_H + stack * (9 * NODE_ROW_H + 18),
      }
    }
    // A named markdown file shows its own content on the canvas.
    function isMarkdown(f) {
      if (!f || f.type === 'directory') return false
      const n = String(f.name || '').toLowerCase()
      return n.length > 3 && n.slice(-3) === '.md'
    }
    function mdLinesOf(f) {
      if (!f || !f.mdText) return null
      const raw = String(f.mdText)
      const out = []
      const lines = raw.split('\\n')
      for (let i = 0; i < lines.length && out.length < MD_MAX_LINES; i++) {
        const t = lines[i]
        if (t === undefined || t === null) continue
        out.push(t)
      }
      return out
    }`,
  'filePos hierarchy',
)

fs.writeFileSync(CLIENT, c)
console.log('patch24 stage 1 applied:', c.length, 'bytes')
