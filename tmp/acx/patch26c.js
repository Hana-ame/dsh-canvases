'use strict'
// patch26 stage C: draw folder boxes, box edges, box hit-testing, fit, split panel,
// and the manual-mutation call sites that must bump manualVersion.
const fs = require('fs')
const C = '/tmp/acx/v21.client.js'
let c = fs.readFileSync(C, 'utf8')

function sub(from, to, label) {
  const n = c.split(from).length - 1
  if (n === 0) throw new Error('ANCHOR MISSING: ' + label)
  if (n > 1) throw new Error('ANCHOR NOT UNIQUE (' + n + '): ' + label)
  c = c.replace(from, to)
}

// ---------------- edges: agent -> top box, parent box -> child box ----------------
sub(
  `        // edges
        g.lineWidth = 1.5
        for (let i = 0; i < st.files.length; i++) {
          const f = st.files[i]
          if (!f.agentId) continue
          const owner = agentsById[f.agentId]
          if (!owner) continue
          const p = livePosOf(f)
          if (!vis(p.x, p.y, FILE_W, nodeH(f))) continue
          const ap = agentPosOf(owner)
          const x1 = ap.x + AGENT_SIZE / 2
          const y1 = ap.y + AGENT_SIZE / 2
          const x2 = p.x
          const y2 = p.y + FILE_H / 2
          const mx = (x1 + x2) / 2
          g.strokeStyle = f.isNew ? pal.fresh : pal.line
          g.setLineDash(f.isNew ? [6, 4] : [4, 5])
          g.beginPath()
          g.moveTo(x1, y1)
          g.bezierCurveTo(mx, y1, mx, y2, x2, y2)
          g.stroke()
        }
        g.setLineDash([])`,
  `        // edges: agent -> its top-level folders, and each folder -> its subfolders
        g.lineWidth = 1.5
        g.strokeStyle = pal.line
        g.setLineDash([4, 5])
        for (let i = 0; i < sections.length; i++) {
          const s = sections[i]
          const x2 = s.x
          const y2 = s.y + 14
          let x1 = 0
          let y1 = 0
          const ps = s.parentKey === null ? undefined : sectionByKey[s.parentKey]
          if (ps === undefined) {
            const owner = agentsById[s.agentId]
            if (!owner) continue
            const ap = agentPosOf(owner)
            x1 = ap.x + AGENT_SIZE / 2
            y1 = ap.y + AGENT_SIZE / 2
          } else {
            x1 = ps.x + ps.w
            y1 = ps.y + 14
          }
          const box = { x: Math.min(x1, x2) - 2, y: Math.min(y1, y2) - 2, w: Math.abs(x2 - x1) + 4, h: Math.abs(y2 - y1) + 4 }
          if (!vis(box.x, box.y, box.w, box.h)) continue
          const mx = (x1 + x2) / 2
          g.beginPath()
          g.moveTo(x1, y1)
          g.bezierCurveTo(mx, y1, mx, y2, x2, y2)
          g.stroke()
        }
        g.setLineDash([])
        // folder boxes: one per directory, its direct files stacked inside
        for (let i = 0; i < sections.length; i++) {
          const s = sections[i]
          if (!vis(s.x, s.y, s.w, s.h)) continue
          roundRectPath(g, s.x, s.y, s.w, s.h, 12)
          g.fillStyle = pal.dirBg
          g.fill()
          g.lineWidth = 1
          g.strokeStyle = st.fileSel.indexOf(s.dirPath) >= 0 ? pal.accent : pal.border
          g.stroke()
          g.font = '11.5px ' + FONT_STACK
          g.fillStyle = pal.label
          g.fillText(clipText(g, '[D] ' + s.name, s.w - 66), s.x + 10, s.y + 15)
          g.font = '10px ' + FONT_STACK
          g.fillStyle = pal.dim
          g.textAlign = 'right'
          g.fillText(String(s.files.length) + (s.total > s.files.length ? ' / ' + String(s.total) : '') + ' 项', s.x + s.w - 10, s.y + 15)
          g.textAlign = 'left'
        }`,
  'box edges and boxes',
)

// ---------------- file loop: directories are boxes now ----------------
sub(
  `        for (let i = 0; i < st.files.length; i++) {
          const f = st.files[i]
          const p = livePosOf(f)
          const nh = nodeH(f)
          if (!vis(p.x, p.y, FILE_W, nh)) continue
          drawn += 1
          const isDir = f.type === 'directory'
          const isMd = isMarkdown(f)`,
  `        for (let i = 0; i < st.files.length; i++) {
          const f = st.files[i]
          if (f.type === 'directory') continue
          const p = livePosOf(f)
          const nh = nodeH(f)
          if (!vis(p.x, p.y, FILE_W, nh)) continue
          drawn += 1
          const isDir = false
          const isMd = isMarkdown(f)`,
  'file loop skips dirs',
)

// ---------------- hit test: files (no dirs) then boxes ----------------
sub(
  `        for (let i = st.files.length - 1; i >= 0; i--) {
          const f = st.files[i]
          const p = livePosOf(f)
          if (wx >= p.x && wx <= p.x + FILE_W && wy >= p.y && wy <= p.y + nodeH(f)) return { kind: 'file', file: f }
        }
        return null`,
  `        for (let i = st.files.length - 1; i >= 0; i--) {
          const f = st.files[i]
          if (f.type === 'directory') continue
          const p = livePosOf(f)
          if (wx >= p.x && wx <= p.x + FILE_W && wy >= p.y && wy <= p.y + nodeH(f)) return { kind: 'file', file: f }
        }
        // folder boxes last, so a file inside a box is always picked before its box
        for (let i = sections.length - 1; i >= 0; i--) {
          const s = sections[i]
          if (wx >= s.x && wx <= s.x + s.w && wy >= s.y && wy <= s.y + s.h) {
            const df = s.dirPath === null ? undefined : fileByPath[s.dirPath]
            if (df !== undefined) return { kind: 'file', file: df }
          }
        }
        return null`,
  'hitTest boxes',
)

// ---------------- fit: include boxes ----------------
sub(
  `        for (let i = 0; i < st.files.length; i++) {
          const f = st.files[i]
          const p = filePosOf(f)
          see(p.x, p.y, FILE_W, nodeH(f))
        }
        if (minX === Infinity) { setPan({ x: 36, y: 30 }); setZoom(1); return }`,
  `        for (let i = 0; i < st.files.length; i++) {
          const f = st.files[i]
          if (f.type === 'directory') continue
          const p = filePosOf(f)
          see(p.x, p.y, FILE_W, nodeH(f))
        }
        for (let i = 0; i < sections.length; i++) see(sections[i].x, sections[i].y, sections[i].w, sections[i].h)
        if (minX === Infinity) { setPan({ x: 36, y: 30 }); setZoom(1); return }`,
  'fit includes boxes',
)

// ---------------- manual mutations bump ----------------
sub(
  `          if (it.moved) {
            manual[it.path] = { x: it.x, y: it.y }
            store.set({})
            return
          }
          toggleFile(it.path)`,
  `          if (it.moved) {
            // dropping a file here SPLITS it out of its folder box: it keeps this spot
            // as an independent node instead of a slot in the box.
            manual[it.path] = { x: it.x, y: it.y }
            bumpManual()
            return
          }
          toggleFile(it.path)`,
  'drag commits via bumpManual',
)

sub(
  `          for (const k in manual) delete manual[k]
          store.set({})
        } }, '重排'),`,
  `          for (const k in manual) delete manual[k]
          bumpManual()
        } }, '重排'),`,
  '重排 bumps',
)

sub(
  `          clearCache()
          for (const k in manual) delete manual[k]
          store.set({ agents: [], agentSel: [], activeAgentId: null, workspace: null, fileSel: [], files: [], wsError: null })`,
  `          clearCache()
          for (const k in manual) delete manual[k]
          store.set({ agents: [], agentSel: [], activeAgentId: null, workspace: null, fileSel: [], files: [], wsError: null, inspectDir: null, manualVersion: (store.get().manualVersion || 0) + 1 })`,
  '清空 bumps',
)

// ---------------- opening an agent closes the folder panel ----------------
sub(
  "      function openInspector(agent) {",
  "      function openInspector(agent) {\n        store.set({ inspectDir: null })",
  'openInspector clears dir panel',
)

fs.writeFileSync(C, c)
console.log('patch26 stage C ok:', c.length)
