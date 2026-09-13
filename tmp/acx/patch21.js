'use strict'
// pkg-21: render the graph on a real <canvas> (Canvas 2D) instead of thousands of DOM nodes.
//
// Why 2D and not pixi/three: the client sandbox has no import/require and fetch is redirected,
// so a third-party renderer cannot be loaded. Canvas 2D is built in, needs no dependency,
// and with viewport culling it draws only what is visible.
//
// Performance model after this change:
//   * pointermove during drag -> mutate one ref + rAF redraw, ZERO React renders;
//   * draw cost is proportional to VISIBLE nodes, not total nodes;
//   * hit testing is a single reverse scan of plain arithmetic.
// DOM is kept only for what it is good at: toolbar, dialogs, inspector, chat dock, hover cards.
const fs = require('fs')
const path = require('path')
const DIR = '/tmp/acx'
const readp = (p) => fs.readFileSync(p, 'utf8')
function sub(text, anchor, replacement, label) {
  const a = text.indexOf(anchor)
  if (a < 0) throw new Error('ANCHOR MISSING: ' + label)
  if (text.indexOf(anchor, a + 1) >= 0) throw new Error('ANCHOR NOT UNIQUE: ' + label)
  return text.slice(0, a) + replacement + text.slice(a + anchor.length)
}
function subRange(text, startAnchor, endAnchor, replacement, label) {
  const a = text.indexOf(startAnchor)
  if (a < 0) throw new Error('RANGE START MISSING: ' + label)
  if (text.indexOf(startAnchor, a + 1) >= 0) throw new Error('RANGE START NOT UNIQUE: ' + label)
  const b = text.indexOf(endAnchor, a)
  if (b < 0) throw new Error('RANGE END MISSING: ' + label)
  return text.slice(0, a) + replacement + text.slice(b)
}

let c = readp(path.join(DIR, 'v20.client.js'))
let host = readp(path.join(DIR, 'v20.host.js'))

// ============================================================ 1. CSS: canvas surface
c = sub(c,
  "  '.acx-canvas{position:absolute;inset:0;z-index:1;overflow:hidden;cursor:grab;touch-action:none;background-color:var(--dsw-alias-bg-base,transparent);background-image:radial-gradient(var(--dsw-alias-border-l1,rgba(127,127,127,.35)) 1px,transparent 1px);background-size:22px 22px}',\n" +
  "  '.acx-canvas[data-panning=1]{cursor:grabbing}',\n",
  "  '.acx-canvas{position:absolute;inset:0;z-index:0;pointer-events:none;background-color:var(--dsw-alias-bg-base,transparent);background-image:radial-gradient(var(--dsw-alias-border-l1,rgba(127,127,127,.35)) 1px,transparent 1px);background-size:22px 22px}',\n" +
  "  '.acx-graph{position:absolute;inset:0;z-index:1;display:block;width:100%;height:100%;touch-action:none;cursor:grab}',\n" +
  "  '.acx-graph[data-panning=1]{cursor:grabbing}',\n" +
  "  '.acx-layer{position:absolute;inset:0;z-index:2;pointer-events:none}',\n", 'canvas css')

// dead rule from the DOM renderer
c = sub(c, "  '.acx-content{position:absolute;left:0;top:0;width:4200px;height:3200px}',\n", '', 'dead content css')

// ============================================================ 2. refs for the canvas view
c = sub(c,
  "      const contentRef = React.useRef(null)\n",
  "      const viewRef = React.useRef({ x: 36, y: 30, z: 1 })\n" +
  "      const paletteRef = React.useRef(null)\n" +
  "      const liveRef = React.useRef(null)\n" +
  "      const interactionRef = React.useRef(null)\n" +
  "      const drawPendingRef = React.useRef(false)\n" +
  "      const drawRef = React.useRef(null)\n", 'refs')

// ============================================================ 3. canvas geometry + palette + draw
const drawBlock = `      function pointIn(rect, e) {
        const v = viewRef.current
        return { x: (e.clientX - rect.left - v.x) / v.z, y: (e.clientY - rect.top - v.y) / v.z }
      }
      function canvasRect() {
        const el = canvasRef.current
        if (!el || typeof el.getBoundingClientRect !== 'function') return { left: 0, top: 0 }
        return el.getBoundingClientRect()
      }
      function point(e) {
        return pointIn(canvasRect(), e)
      }
      function readPalette() {
        const fb = {
          label: '#e8eaed', dim: '#9aa4b2', accent: '#4d6bfe', fresh: '#2ea043',
          border: 'rgba(127,127,127,.4)', line: 'rgba(127,127,127,.45)',
          fileBg: 'rgba(127,127,127,.07)', dirBg: 'rgba(127,127,127,.13)', white: '#ffffff',
        }
        try {
          const el = canvasRef.current
          if (!el || typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') return fb
          const cs = window.getComputedStyle(el)
          const get = function (name, dflt) {
            const v = cs.getPropertyValue(name)
            const t = v && v.trim() ? v.trim() : ''
            return t.length > 0 ? t : dflt
          }
          return {
            label: get('--dsw-alias-label-primary', fb.label),
            dim: get('--dsw-alias-label-secondary', fb.dim),
            accent: get('--dsw-alias-brand-primary', fb.accent),
            fresh: get('--dsw-alias-state-success-primary', fb.fresh),
            border: get('--dsw-alias-border-l2', fb.border),
            line: fb.line,
            fileBg: fb.fileBg,
            dirBg: fb.dirBg,
            white: fb.white,
          }
        } catch (e) {
          return fb
        }
      }
      function roundRectPath(g, x, y, w, h, r) {
        if (typeof g.roundRect === 'function') {
          g.beginPath()
          g.roundRect(x, y, w, h, r)
          return
        }
        const rr = Math.min(r, w / 2, h / 2)
        g.beginPath()
        g.moveTo(x + rr, y)
        g.lineTo(x + w - rr, y)
        g.quadraticCurveTo(x + w, y, x + w, y + rr)
        g.lineTo(x + w, y + h - rr)
        g.quadraticCurveTo(x + w, y + h, x + w - rr, y + h)
        g.lineTo(x + rr, y + h)
        g.quadraticCurveTo(x, y + h, x, y + h - rr)
        g.lineTo(x, y + rr)
        g.quadraticCurveTo(x, y, x + rr, y)
        g.closePath()
      }
      function clipText(g, text, maxW) {
        const s = String(text === undefined || text === null ? '' : text)
        if (s.length === 0) return ''
        if (g.measureText(s).width <= maxW) return s
        let lo = 0
        let hi = s.length
        while (lo < hi) {
          const mid = Math.ceil((lo + hi) / 2)
          if (g.measureText(s.slice(0, mid) + '...').width <= maxW) lo = mid
          else hi = mid - 1
        }
        return s.slice(0, lo) + '...'
      }
      function livePosOf(f) {
        const ov = liveRef.current
        if (ov !== null && ov.kind === 'file' && ov.path === f.path) return { x: ov.x, y: ov.y }
        return filePosOf(f)
      }
      function agentPosOf(a) {
        const ov = liveRef.current
        if (ov !== null && ov.kind === 'agent' && ov.id === a.id) return { x: ov.x, y: ov.y }
        return { x: a.x, y: a.y }
      }
      function drawGraph() {
        const el = canvasRef.current
        if (!el || typeof el.getContext !== 'function') return
        let g = null
        try {
          g = el.getContext('2d')
        } catch (e) {
          return
        }
        if (!g) return
        const pal = paletteRef.current || readPalette()
        const dpr = typeof window !== 'undefined' && window.devicePixelRatio ? Math.min(window.devicePixelRatio, 2) : 1
        const w = el.clientWidth || 800
        const h = el.clientHeight || 600
        const pxW = Math.max(1, Math.round(w * dpr))
        const pxH = Math.max(1, Math.round(h * dpr))
        if (el.width !== pxW || el.height !== pxH) {
          el.width = pxW
          el.height = pxH
        }
        const v = viewRef.current
        g.setTransform(1, 0, 0, 1, 0, 0)
        g.clearRect(0, 0, el.width, el.height)
        g.setTransform(dpr * v.z, 0, 0, dpr * v.z, dpr * v.x, dpr * v.y)
        const view = { x0: -v.x / v.z, y0: -v.y / v.z, x1: (-v.x + w) / v.z, y1: (-v.y + h) / v.z }
        const vis = function (x, y, ww, hh) {
          return !(x + ww < view.x0 || x > view.x1 || y + hh < view.y0 || y > view.y1)
        }
        let drawn = 0
        // edges
        g.lineWidth = 1.5
        for (let i = 0; i < st.files.length; i++) {
          const f = st.files[i]
          if (!f.agentId) continue
          const owner = agentsById[f.agentId]
          if (!owner) continue
          const p = livePosOf(f)
          if (!vis(p.x, p.y, FILE_W, FILE_H)) continue
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
        g.setLineDash([])
        // file nodes
        g.textBaseline = 'middle'
        g.textAlign = 'left'
        for (let i = 0; i < st.files.length; i++) {
          const f = st.files[i]
          const p = livePosOf(f)
          if (!vis(p.x, p.y, FILE_W, FILE_H)) continue
          drawn += 1
          const isDir = f.type === 'directory'
          roundRectPath(g, p.x, p.y, FILE_W, FILE_H, 9)
          g.fillStyle = isDir ? pal.dirBg : pal.fileBg
          g.fill()
          g.lineWidth = 1
          g.strokeStyle = f.isNew ? pal.fresh : pal.border
          g.stroke()
          if (st.fileSel.indexOf(f.path) >= 0) {
            roundRectPath(g, p.x - 1.5, p.y - 1.5, FILE_W + 3, FILE_H + 3, 10)
            g.lineWidth = 2
            g.strokeStyle = pal.accent
            g.stroke()
          }
          g.font = '11.5px ' + FONT_STACK
          g.fillStyle = pal.label
          g.fillText(clipText(g, (isDir ? '[D] ' : '[F] ') + f.name, FILE_W - 16), p.x + 8, p.y + 15)
          g.font = '10px ' + FONT_STACK
          g.fillStyle = pal.dim
          g.fillText(clipText(g, f.rel || f.name, FILE_W - 18), p.x + 8, p.y + 32)
          if (f.isNew) {
            g.fillStyle = pal.fresh
            g.textAlign = 'right'
            g.fillText('new', p.x + FILE_W - 8, p.y + 32)
            g.textAlign = 'left'
          }
        }
        // agents on top
        for (let i = 0; i < st.agents.length; i++) {
          const a = st.agents[i]
          const ap = agentPosOf(a)
          if (!vis(ap.x, ap.y, AGENT_SIZE, AGENT_SIZE)) continue
          drawn += 1
          const cx = ap.x + AGENT_SIZE / 2
          const cy = ap.y + AGENT_SIZE / 2
          g.beginPath()
          g.arc(cx, cy, AGENT_SIZE / 2, 0, Math.PI * 2)
          g.fillStyle = a.color || '#6366f1'
          g.fill()
          if (a.pending) {
            g.lineWidth = 2
            g.strokeStyle = pal.dim
            g.setLineDash([4, 3])
            g.stroke()
            g.setLineDash([])
          }
          if (a.error) {
            g.lineWidth = 2
            g.strokeStyle = pal.fresh === '#2ea043' ? '#d54941' : pal.fresh
            g.stroke()
          }
          if (st.agentSel.indexOf(a.id) >= 0 || (hoverAgentId !== null && hoverAgentId === a.id)) {
            g.lineWidth = 3
            g.strokeStyle = pal.white
            g.stroke()
          }
          g.fillStyle = pal.white
          g.font = 'bold 15px ' + FONT_STACK
          g.textAlign = 'center'
          g.fillText(initials(a.name), cx, cy + 1)
          g.font = '10.5px ' + FONT_STACK
          g.fillStyle = pal.dim
          g.fillText(clipText(g, a.name, 92), cx, ap.y + AGENT_SIZE + 11)
          const counts = agentFileCount[a.id]
          if (counts !== undefined && counts.fresh > 0) {
            g.beginPath()
            g.arc(ap.x - 2, ap.y - 2, 8, 0, Math.PI * 2)
            g.fillStyle = pal.fresh
            g.fill()
            g.fillStyle = pal.white
            g.font = '10px ' + FONT_STACK
            g.fillText(String(counts.fresh), ap.x - 2, ap.y - 1)
          }
          const sess = st.sessions[a.sessionId]
          if (sess && sess.live) {
            g.beginPath()
            g.arc(ap.x + AGENT_SIZE - 2, ap.y + 2, 5, 0, Math.PI * 2)
            g.fillStyle = pal.fresh
            g.fill()
          }
        }
        g.textAlign = 'left'
        g.setTransform(1, 0, 0, 1, 0, 0)
        lastDrawCount = drawn
      }
      function scheduleDraw() {
        if (drawPendingRef.current === true) return
        drawPendingRef.current = true
        const run = function () {
          drawPendingRef.current = false
          const fn = drawRef.current
          if (typeof fn === 'function') fn()
        }
        try {
          if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(run)
            return
          }
        } catch (e) {}
        run()
      }
      function hitTest(wx, wy) {
        const r = AGENT_SIZE / 2 + 3
        for (let i = st.agents.length - 1; i >= 0; i--) {
          const a = st.agents[i]
          const ap = agentPosOf(a)
          const dx = wx - (ap.x + AGENT_SIZE / 2)
          const dy = wy - (ap.y + AGENT_SIZE / 2)
          if (dx * dx + dy * dy <= r * r) return { kind: 'agent', agent: a }
        }
        for (let i = st.files.length - 1; i >= 0; i--) {
          const f = st.files[i]
          const p = livePosOf(f)
          if (wx >= p.x && wx <= p.x + FILE_W && wy >= p.y && wy <= p.y + FILE_H) return { kind: 'file', file: f }
        }
        return null
      }
      function onGraphPointerDown(e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return
        dragActive = true
        const rect = canvasRect()
        const p = pointIn(rect, e)
        try { e.currentTarget.setPointerCapture(e.pointerId) } catch (err) {}
        const hit = hitTest(p.x, p.y)
        if (hit !== null && hit.kind === 'agent') {
          const agent = hit.agent
          const canDrag = store.get().mode === 'agent'
          pressedAgentRef.current = agent.id
          interactionRef.current = { kind: 'agent', id: agent.id, canDrag: canDrag, dx: p.x - agent.x, dy: p.y - agent.y, x0: p.x, y0: p.y, moved: false, rect: rect, x: agent.x, y: agent.y }
          setHoverAgentId(null)
          setHoverFile(null)
          if (canDrag) setDraggingId(agent.id)
          const multi = multiMode || e.metaKey || e.ctrlKey || e.shiftKey
          if (multi) toggleAgent(agent.id)
          else store.set({ agentSel: [agent.id], activeAgentId: agent.id })
          return
        }
        if (hit !== null && hit.kind === 'file') {
          const f = hit.file
          const canDrag = store.get().mode === 'file'
          const pos = filePosOf(f)
          interactionRef.current = {
            kind: 'file', path: f.path, dx: p.x - pos.x, dy: p.y - pos.y, x0: p.x, y0: p.y,
            moved: false, canDrag: canDrag, rect: rect, x: pos.x, y: pos.y,
          }
          if (canDrag) setDraggingFile(f.path)
          return
        }
        interactionRef.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y, x: pan.x, y: pan.y }
      }
      function onGraphPointerMove(e) {
        const it = interactionRef.current
        if (it === null) return
        if (it.kind === 'pan') {
          it.x = it.px + (e.clientX - it.sx)
          it.y = it.py + (e.clientY - it.sy)
          viewRef.current.x = it.x
          viewRef.current.y = it.y
          try { e.currentTarget.dataset.panning = '1' } catch (err) {}
          scheduleDraw()
          return
        }
        const p = pointIn(it.rect, e)
        const movedEnough = it.moved || Math.abs(p.x - it.x0) > 3 || Math.abs(p.y - it.y0) > 3
        if (it.kind === 'agent') {
          if (!it.canDrag) return
          if (!movedEnough) return
          it.moved = true
          it.x = p.x - it.dx
          it.y = p.y - it.dy
          liveRef.current = { kind: 'agent', id: it.id, x: it.x, y: it.y }
          scheduleDraw()
          return
        }
        if (it.kind === 'file') {
          if (!it.canDrag) return
          if (!movedEnough) return
          it.moved = true
          it.x = p.x - it.dx
          it.y = p.y - it.dy
          liveRef.current = { kind: 'file', path: it.path, x: it.x, y: it.y }
          scheduleDraw()
        }
      }
      function onGraphHover(e) {
        if (interactionRef.current !== null) return
        const rect = canvasRect()
        const p = pointIn(rect, e)
        const hit = hitTest(p.x, p.y)
        const aid = hit !== null && hit.kind === 'agent' ? hit.agent.id : null
        const fpath = hit !== null && hit.kind === 'file' ? hit.file.path : null
        if (aid !== hoverAgentId) setHoverAgentId(aid)
        if (fpath !== hoverFile) setHoverFile(fpath)
      }
      function onGraphPointerUp(e) {
        const it = interactionRef.current
        interactionRef.current = null
        dragActive = false
        liveRef.current = null
        try { e.currentTarget.dataset.panning = '0' } catch (err) {}
        try { e.currentTarget.releasePointerCapture(e.pointerId) } catch (err) {}
        if (it === null) return
        if (it.kind === 'pan') {
          if (it.x !== pan.x || it.y !== pan.y) setPan({ x: it.x, y: it.y })
          else scheduleDraw()
          return
        }
        if (it.kind === 'agent') {
          setDraggingId(null)
          if (it.moved) {
            const agents = store.get().agents
            const next = []
            for (let i = 0; i < agents.length; i++) next.push(agents[i].id === it.id ? merge(agents[i], { x: it.x, y: it.y }) : agents[i])
            store.set({ agents: next })
            return
          }
          const a2 = findAgent(store.get().agents, it.id)
          if (a2) openInspector(a2)
          return
        }
        if (it.kind === 'file') {
          setDraggingFile(null)
          if (it.moved) {
            manual[it.path] = { x: it.x, y: it.y }
            store.set({})
            return
          }
          toggleFile(it.path)
          if (touchMode) setInfo({ kind: 'file', path: it.path })
        }
      }
      function onGraphDoubleClick(e) {
        const rect = canvasRect()
        const p = pointIn(rect, e)
        const hit = hitTest(p.x, p.y)
        if (hit !== null && hit.kind === 'agent' && hit.agent.sessionId) openInSidebar(hit.agent.sessionId)
      }
      function onGraphWheel(e) {
        const el = canvasRef.current
        if (!el) return
        const delta = typeof e.deltaY === 'number' ? e.deltaY : 0
        if (delta === 0) return
        const step = delta > 0 ? 0.9 : 1.1
        const z0 = zoom
        let nz = Math.round(z0 * step * 100) / 100
        if (nz < 0.3) nz = 0.3
        if (nz > 2) nz = 2
        if (nz === z0) return
        const rect = el.getBoundingClientRect()
        const mx = e.clientX - rect.left
        const my = e.clientY - rect.top
        setPan({ x: mx - (mx - pan.x) * (nz / z0), y: my - (my - pan.y) * (nz / z0) })
        setZoom(nz)
      }
`
c = subRange(c,
  "      function pointIn(rect, e) {\n",
  "      function onAgentPointerDown(e, agent) {\n",
  drawBlock, 'canvas draw block')

// drop the old per-node DOM drag handlers entirely
c = subRange(c,
  "      function onAgentPointerDown(e, agent) {\n",
  "      function filePosOf(f) {\n",
  "", 'remove dom drag handlers')

// ============================================================ 4. draw on every state change
c = sub(c,
  "      React.useEffect(function () {\n        if (!toast) return\n",
  "      React.useEffect(function () {\n" +
  "        viewRef.current.x = pan.x\n" +
  "        viewRef.current.y = pan.y\n" +
  "        viewRef.current.z = zoom\n" +
  "        paletteRef.current = readPalette()\n" +
  "        drawRef.current = drawGraph\n" +
  "        drawGraph()\n" +
  "      }, [st, pan, zoom, hoverAgentId, hoverFile, draggingId, draggingFile])\n" +
  "      React.useEffect(function () {\n" +
  "        const el = canvasRef.current\n" +
  "        const onResize = function () { scheduleDraw() }\n" +
  "        let ro = null\n" +
  "        try {\n" +
  "          if (el && typeof ResizeObserver === 'function') {\n" +
  "            ro = new ResizeObserver(onResize)\n" +
  "            ro.observe(el)\n" +
  "          } else if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {\n" +
  "            window.addEventListener('resize', onResize)\n" +
  "          }\n" +
  "        } catch (e) {}\n" +
  "        scheduleDraw()\n" +
  "        return function () {\n" +
  "          try {\n" +
  "            if (ro) ro.disconnect()\n" +
  "            else if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') window.removeEventListener('resize', onResize)\n" +
  "          } catch (e) {}\n" +
  "        }\n" +
  "      }, [])\n" +
  "      React.useEffect(function () {\n        if (!toast) return\n", 'draw effects')

// ============================================================ 5. replace the DOM graph with the canvas
const tail = `      const hoveredAgent = hoverAgentId ? findAgent(st.agents, hoverAgentId) : null
      const hoveredFileObj = hoverFile ? (fileByPath[hoverFile] || null) : null
      const screenX = function (wx) { return wx * zoom + pan.x }
      const screenY = function (wy) { return wy * zoom + pan.y }
      const hoverCards = []
      if (hoveredAgent !== null && interactionRef.current === null) {
        hoverCards.push(h('div', {
          key: 'hover-agent',
          className: 'acx-hover',
          style: { left: (screenX(hoveredAgent.x + AGENT_SIZE + 14)) + 'px', top: (screenY(hoveredAgent.y - 10)) + 'px' },
        },
          h('div', null, h('b', { style: { color: hoveredAgent.color } }, hoveredAgent.name)),
          agentInfoRows(hoveredAgent),
        ))
      }
      if (hoveredFileObj !== null && interactionRef.current === null) {
        const hp = filePosOf(hoveredFileObj)
        hoverCards.push(h('div', {
          key: 'hover-file',
          className: 'acx-hover',
          style: { left: (screenX(hp.x + 20)) + 'px', top: (screenY(hp.y + FILE_H + 6)) + 'px' },
        },
          h('div', null, h('b', null, hoveredFileObj.name)),
          fileInfoRows(hoveredFileObj),
        ))
      }
      const over = hoveredFileObj || hoveredAgent
      const graph = h('canvas', {
        className: 'acx-graph',
        ref: canvasRef,
        'data-panning': panRef.current ? '1' : '0',
        onPointerDown: onGraphPointerDown,
        onPointerMove: function (e) { onGraphPointerMove(e); onGraphHover(e) },
        onPointerUp: onGraphPointerUp,
        onPointerCancel: onGraphPointerUp,
        onPointerLeave: function () { setHoverAgentId(null); setHoverFile(null) },
        onDoubleClick: onGraphDoubleClick,
        onWheel: onGraphWheel,
      })
      const layers = h('div', { className: 'acx-layer' },
        st.agents.length === 0
          ? h('div', { className: 'acx-empty', style: { position: 'absolute', left: 0, right: 0, top: '34%' } },
              '\\u5148\\u70b9\\u300c\\u7ed1\\u5b9a\\u5de5\\u4f5c\\u533a\\u300d\\u7ed1\\u5b9a\\u4e00\\u4e2a\\u6587\\u4ef6\\u5939\\uff0c\\u518d\\u7528\\u300c+ Agent\\u300d\\u521b\\u5efa\\u4f1a\\u8bdd\\u3002\\u6bcf\\u4e2a agent \\u5728\\u8be5\\u5de5\\u4f5c\\u533a\\u5185\\u62e5\\u6709\\u81ea\\u5df1\\u7684\\u5b50\\u76ee\\u5f55\\uff0c\\u5b83\\u521b\\u5efa\\u7684\\u6bcf\\u4e2a\\u6587\\u4ef6\\u90fd\\u4f1a\\u4f5c\\u4e3a\\u8282\\u70b9\\u51fa\\u73b0\\u3002')
          : null,
        hoverCards,
      )
      let infoSheet = null
      if (info && info.kind === 'agent') {
        const a = findAgent(st.agents, info.id)
        if (a) {
          infoSheet = h('div', { className: 'acx-sheet' },
            h('div', { className: 'acx-sheet-head' },
              h('b', { style: { color: a.color } }, a.name),
              h('button', { className: 'acx-btn', onClick: function () { setInfo(null) } }, '\\u5173\\u95ed'),
            ),
            agentInfoRows(a),
          )
        }
      } else if (info && info.kind === 'file') {
        const f = fileByPath[info.path] || null
        if (f) {
          infoSheet = h('div', { className: 'acx-sheet' },
            h('div', { className: 'acx-sheet-head' },
              h('b', null, f.name),
              h('button', { className: 'acx-btn', onClick: function () { setInfo(null) } }, '\\u5173\\u95ed'),
            ),
            fileInfoRows(f),
          )
        }
      }
      const legend = h('div', { className: 'acx-legend' },
        h('span', null, st.workspace ? basename(st.workspace) : '(\\u672a\\u9009\\u5de5\\u4f5c\\u533a)'),
        h('span', null, 'agent ' + String(st.agents.length) + ' \\u00b7 \\u6587\\u4ef6 ' + String(st.files.length) + (mountedDraws > 0 ? ' \\u00b7 \\u753b ' + String(mountedDraws) : '')),
        st.scanNote ? h('span', null, st.scanNote) : null,
        st.wsError ? h('span', { style: { color: 'var(--dsw-alias-label-error, #d4380d)' } }, String(st.wsError)) : null,
      )
      return h('div', { className: touchMode ? 'acx-root acx-touch' : 'acx-root' },
        h('div', { className: 'acx-canvas' }),
        graph,
        layers,
        bar,
        legend,
        st.dock ? h(ChatDock, { touch: touchMode }) : null,
        formEl,
        infoSheet,
        toast ? h('div', { className: 'acx-toast' }, toast.text) : null,
      )
    }
`
c = subRange(c,
  "      const hoveredAgent = hoverAgentId ? findAgent(st.agents, hoverAgentId) : null\n",
  "    function RunCard() {\n", tail, 'canvas tail')

// renderFile / renderAgent are gone (the canvas draws nodes); their info rows stay
c = subRange(c,
  "      function renderFile(f) {\n",
  "      function agentInfoRows(a) {\n", "", 'drop renderFile/renderAgent')

// FONT_STACK + lastDrawCount live at module scope
c = sub(c,
  "const COLORS = ['#6366f1',",
  "const FONT_STACK = 'ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif'\nlet lastDrawCount = 0\nconst COLORS = ['#6366f1',", 'module consts')

// the DOM edge/svg builder and the old hover-card helpers are dead once the canvas draws
c = subRange(c,
  "      function hoverAgentCard(a) {\n",
  "      const pickedFiles = st.files.filter(",
  "", 'drop dead svg/edge builder')
c = sub(c, "      const over = hoveredFileObj || hoveredAgent\n", "", 'drop unused over')
if ((c.match(/st\.files\.map\(/g) || []).length !== 1) throw new Error('per-file element maps: ' + String((c.match(/st\.files\.map\(/g) || []).length))
if (c.indexOf("const svg = h('svg'") >= 0) throw new Error('svg builder survives')

// pkg-20 left the pre-existing store.set in place, so refresh committed twice per cycle
c = sub(c,
  "      store.set({ sessions: sessions, sessionList: sessionList, agents: agents, files: files, scanNote: note, lastScan: now })\n" +
  "      store.set({ sessions: sessions, sessionList: sessionList, agents: agents, files: files, scanNote: note, lastScan: Date.now() })\n",
  "      store.set({ sessions: sessions, sessionList: sessionList, agents: agents, files: files, scanNote: note, lastScan: now })\n", 'dedupe refresh commit')

if ((c.match(/lastScan: now/g) || []).length !== 1) throw new Error('refresh commits more than once')

c = sub(c, "agent-canvas] client apply pkg-20", "agent-canvas] client apply pkg-21", 'client tag')
host = sub(host, "host apply pkg-20", "host apply pkg-21", 'host tag')

// the legend shows how many nodes the last frame actually drew (culling is observable)
c = sub(c, "        h('span', null, 'agent ' + String(st.agents.length) + ' \\u00b7 \\u6587\\u4ef6 ' + String(st.files.length) + (mountedDraws > 0 ? ' \\u00b7 \\u753b ' + String(mountedDraws) : '')),",
  "        h('span', null, 'agent ' + String(st.agents.length) + ' \\u00b7 \\u6587\\u4ef6 ' + String(st.files.length) + (lastDrawCount > 0 ? ' \\u00b7 \\u5f53\\u5e27\\u7ed8\\u5236 ' + String(lastDrawCount) : '')),", 'legend draw count')

// ============================================================ checks
for (const pair of [['host', host], ['client', c]]) {
  const name = pair[0]
  const lines = pair[1].split('\n')
  for (let i = 1; i < lines.length; i++) {
    const t = lines[i].trim()
    if (t.length > 12 && t === lines[i - 1].trim()) throw new Error('ADJACENT DUPLICATE in ' + name + ': ' + t)
  }
}
new Function(host)
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
new AsyncFunction(c)

const must = [
  ['canvas element is the graph surface', /className: 'acx-graph'[\s\S]{0,80}ref: canvasRef/],
  ['draw uses a 2d context', /el\.getContext\('2d'\)/],
  ['devicePixelRatio is honoured', /Math\.min\(window\.devicePixelRatio, 2\)/],
  ['view transform is applied', /g\.setTransform\(dpr \* v\.z, 0, 0, dpr \* v\.z, dpr \* v\.x, dpr \* v\.y\)/],
  ['culling is implemented', /const vis = function \(x, y, ww, hh\)/],
  ['edges are culled too', /if \(!vis\(p\.x, p\.y, FILE_W, FILE_H\)\) continue\n          const ap = agentPosOf\(owner\)/],
  ['hit test checks agents first', /for \(let i = st\.agents\.length - 1; i >= 0; i--\) \{/],
  ['hit test checks files', /if \(wx >= p\.x && wx <= p\.x \+ FILE_W && wy >= p\.y && wy <= p\.y \+ FILE_H\) return \{ kind: 'file', file: f \}/],
  ['drag is a ref mutation', /liveRef\.current = \{ kind: 'agent', id: it\.id, x: it\.x, y: it\.y \}/],
  ['redraw is rAF throttled', /window\.requestAnimationFrame\(run\)/],
  ['no react render during drag', !/function onGraphPointerMove\(e\) \{[\s\S]{0,2200}?store\.set\(/.test(c)],
  ['drop commits once (agent)', (/function onGraphPointerUp\(e\) \{[\s\S]*?\n      \}/.exec(c) || [''])[0].indexOf('store.set({ agents: next })') >= 0],
  ['domain renderers removed', c.indexOf('function renderFile(f)') < 0 && c.indexOf('function renderAgent(a)') < 0],
  ['hover cards are screen-space overlays', /const screenX = function \(wx\) \{ return wx \* zoom \+ pan\.x \}/],
  ['palette is read from theme tokens', /get\('--dsw-alias-label-primary', fb\.label\)/],
  ['roundRect has a fallback', /const rr = Math\.min\(r, w \/ 2, h \/ 2\)/],
  ['wheel zoom is anchored', /setPan\(\{ x: mx - \(mx - pan\.x\) \* \(nz \/ z0\)/],
  ['legend reports culled draw count', /\\u5f53\\u5e27\\u7ed8\\u5236 '/],
  ['dead svg builder removed', c.indexOf("const svg = h('svg'") < 0],
  ['render-path edges array removed', (c.match(/const edges = \[\]/g) || []).length === 1 && c.indexOf('const edges = []') < c.indexOf('function CanvasApp()')],
  ['only the export builder maps files', (c.match(/st\.files\.map\(/g) || []).length === 1 && c.indexOf('st.files.map(') < c.indexOf('function detectTouch')],
  ['dead hover helpers removed', c.indexOf('function hoverAgentCard') < 0],
]
let bad = 0
for (const pair of must) if (!pair[1]) { console.log('FAIL ' + pair[0]); bad++ }
if (bad > 0) throw new Error(bad + ' contract checks failed')
console.log('OK patch21: host ' + host.length + ' client ' + c.length)
if (process.argv.indexOf('--write') >= 0) {
  fs.writeFileSync(path.join(DIR, 'v21.host.js'), host)
  fs.writeFileSync(path.join(DIR, 'v21.client.js'), c)
  console.log('wrote v21.host.js / v21.client.js')
}
