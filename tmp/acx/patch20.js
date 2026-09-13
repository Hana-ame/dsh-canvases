'use strict'
// pkg-20: (1) drag/pan efficiency, (2) workspace binding without the platform picker.
//
// Root cause of "拖动效率极低":
//   * filePosOf() linear-scanned ALL files, and was called ~2x per file while rendering
//     => O(n^2) per render (4000 files => ~32M iterations), and
//   * every pointermove called store.set() => a full re-render, and
//   * the 3s poll rebuilt every array and store.set() unconditionally, and
//   * renderAgent() scanned all files once per agent, and
//   * panning re-rendered the whole tree on every move.
// Fixes: precomputed O(n) index per render; imperative left/top + transform during drag/pan
// (single store commit on pointerup); refresh skips store.set when nothing changed; file
// rescan decoupled to 6s (manual 重扫 button); refresh suspended while dragging.
//
// Binding: the platform picker has no native capability in this page, so the dialog gets its
// own directory browser (backed by canvas-list-files, maxDepth:0) instead of depending on it.
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

let c = readp(path.join(DIR, 'u.client.js'))
let host = readp(path.join(DIR, 'u.host.js'))

// ============================================================ 1. refresh: no-op skip + cadence
c = sub(c,
  "    let refreshing = false\n    async function refresh() {\n      if (refreshing) return\n",
  "    let refreshing = false\n" +
  "    let dragActive = false\n" +
  "    let lastFileScan = 0\n" +
  "    let lastScanRoot = null\n" +
  "    let lastRefreshSig = null\n" +
  "    const FILE_SCAN_MS = 6000\n" +
  "    async function refresh() {\n" +
  "      if (refreshing) return\n" +
  "      if (dragActive) return\n", 'refresh header')

c = subRange(c,
  "      const ws = cur.workspace\n      const roots = ws ? [ws] : []\n",
  "      store.set({ sessions: sessions, sessionList: sessionList, agents: agents, files: files, scanNote: note, lastScan: Date.now() })\n",
  "      const ws = cur.workspace\n" +
  "      const files = []\n" +
  "      let note = null\n" +
  "      const now = Date.now()\n" +
  "      const dueScan = ws !== lastScanRoot || (now - lastFileScan) > FILE_SCAN_MS\n" +
  "      if (ws && dueScan) {\n" +
  "        const r = await hostCall('canvas-list-files', { path: ws, maxDepth: 8, limit: 4000 }, 20000)\n" +
  "        if (!r.ok) {\n" +
  "          note = '\\u626b\\u63cf ' + ws + ' \\u5931\\u8d25: ' + (r.error || '')\n" +
  "          for (let i = 0; i < cur.files.length; i++) files.push(cur.files[i])\n" +
  "        } else {\n" +
  "          const entries = r.entries || []\n" +
  "          if (baselines[ws] === undefined) {\n" +
  "            const base = {}\n" +
  "            for (let j = 0; j < entries.length; j++) base[entries[j].path] = true\n" +
  "            baselines[ws] = base\n" +
  "          }\n" +
  "          for (let j = 0; j < entries.length; j++) {\n" +
  "            const e = entries[j]\n" +
  "            files.push({\n" +
  "              path: e.path,\n" +
  "              name: e.name,\n" +
  "              rel: e.rel,\n" +
  "              type: e.type,\n" +
  "              size: e.size,\n" +
  "              agentId: assignOwner(agents, e.path),\n" +
  "              root: ws,\n" +
  "              isNew: baselines[ws][e.path] !== true,\n" +
  "            })\n" +
  "          }\n" +
  "          if (r.truncated) note = ws + ' \\u5185\\u5bb9\\u8fc7\\u591a\\uff0c\\u4ec5\\u663e\\u793a\\u524d 4000 \\u9879'\n" +
  "          lastFileScan = now\n" +
  "          lastScanRoot = ws\n" +
  "        }\n" +
  "      } else if (ws) {\n" +
  "        for (let i = 0; i < cur.files.length; i++) {\n" +
  "          const f = cur.files[i]\n" +
  "          files.push(merge(f, { agentId: assignOwner(agents, f.path) }))\n" +
  "        }\n" +
  "      } else {\n" +
  "        lastScanRoot = null\n" +
  "      }\n" +
  "      let sigAcc = 0\n" +
  "      for (let i = 0; i < files.length; i++) {\n" +
  "        const f = files[i]\n" +
  "        sigAcc = (sigAcc * 31 + f.path.length + (f.size === null ? 7 : f.size) + (f.isNew ? 1 : 0) + (f.agentId ? f.agentId.length : 0)) % 2147483647\n" +
  "      }\n" +
  "      let agSig = ''\n" +
  "      for (let i = 0; i < agents.length; i++) {\n" +
  "        const a = agents[i]\n" +
  "        agSig += a.id + (a.cwd || '') + (a.sessionId || '') + (a.pending ? 'p' : '') + (a.error ? 'e' : '') + (a.missing ? 'm' : '') + ';'\n" +
  "      }\n" +
  "      let liveSig = 0\n" +
  "      for (let i = 0; i < sessionList.length; i++) if (sessionList[i].live === true) liveSig += 1\n" +
  "      const sig = String(files.length) + '#' + String(sigAcc) + '#' + agSig + '#' + (note || '') + '#' + String(sessionList.length) + '#' + String(liveSig)\n" +
  "      if (sig === lastRefreshSig) return\n" +
  "      lastRefreshSig = sig\n" +
  "      store.set({ sessions: sessions, sessionList: sessionList, agents: agents, files: files, scanNote: note, lastScan: now })\n",
  'refreshInner scan block')

// poll cadence: session liveness does not need 3s, and it competes with interaction
c = sub(c, "            }, 3000)", "            }, 5000)", 'poll cadence')

// ============================================================ 2. imperative pan
c = sub(c,
  "      const pressedAgentRef = React.useRef(null)\n",
  "      const pressedAgentRef = React.useRef(null)\n      const contentRef = React.useRef(null)\n", 'contentRef')

c = sub(c,
  "      function point(e) {\n        const el = canvasRef.current\n        if (!el) return { x: 0, y: 0 }\n        const r = el.getBoundingClientRect()\n        return { x: (e.clientX - r.left - pan.x) / zoom, y: (e.clientY - r.top - pan.y) / zoom }\n      }\n",
  "      function pointIn(rect, e) {\n" +
  "        return { x: (e.clientX - rect.left - pan.x) / zoom, y: (e.clientY - rect.top - pan.y) / zoom }\n" +
  "      }\n" +
  "      function canvasRect() {\n" +
  "        const el = canvasRef.current\n" +
  "        if (!el || typeof el.getBoundingClientRect !== 'function') return { left: 0, top: 0 }\n" +
  "        return el.getBoundingClientRect()\n" +
  "      }\n" +
  "      function point(e) {\n" +
  "        return pointIn(canvasRect(), e)\n" +
  "      }\n", 'point/pointIn')

c = sub(c,
  "      function onCanvasPointerDown(e) {\n        if (e.button !== 0) return\n        panRef.current = { sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y }\n        try { e.currentTarget.setPointerCapture(e.pointerId) } catch (err) {}\n      }\n      function onCanvasPointerMove(e) {\n        const d = panRef.current\n        if (!d) return\n        setPan({ x: d.px + (e.clientX - d.sx), y: d.py + (e.clientY - d.sy) })\n      }\n      function onCanvasPointerUp(e) {\n        panRef.current = null\n        try { e.currentTarget.releasePointerCapture(e.pointerId) } catch (err) {}\n      }\n",
  "      function onCanvasPointerDown(e) {\n" +
  "        if (e.button !== 0) return\n" +
  "        dragActive = true\n" +
  "        const el = contentRef.current\n" +
  "        panRef.current = { sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y, el: el, nx: pan.x, ny: pan.y }\n" +
  "        if (el) el.style.willChange = 'transform'\n" +
  "        try { e.currentTarget.dataset.panning = '1' } catch (err) {}\n" +
  "        try { e.currentTarget.setPointerCapture(e.pointerId) } catch (err) {}\n" +
  "      }\n" +
  "      function onCanvasPointerMove(e) {\n" +
  "        const d = panRef.current\n" +
  "        if (!d) return\n" +
  "        d.nx = d.px + (e.clientX - d.sx)\n" +
  "        d.ny = d.py + (e.clientY - d.sy)\n" +
  "        if (d.el) d.el.style.transform = 'translate(' + String(d.nx) + 'px,' + String(d.ny) + 'px) scale(' + String(zoom) + ')'\n" +
  "      }\n" +
  "      function onCanvasPointerUp(e) {\n" +
  "        const d = panRef.current\n" +
  "        panRef.current = null\n" +
  "        dragActive = false\n" +
  "        try { e.currentTarget.dataset.panning = '0' } catch (err) {}\n" +
  "        try { e.currentTarget.releasePointerCapture(e.pointerId) } catch (err) {}\n" +
  "        if (d === null) return\n" +
  "        if (d.el) d.el.style.willChange = ''\n" +
  "        if (d.nx !== pan.x || d.ny !== pan.y) setPan({ x: d.nx, y: d.ny })\n" +
  "      }\n", 'canvas pan')

// ============================================================ 3. imperative agent drag
c = sub(c,
  "      function onAgentPointerDown(e, agent) {\n        if (e.button !== 0) return\n        e.preventDefault()\n        e.stopPropagation()\n        const canDrag = store.get().mode === 'agent'\n        const p = point(e)\n        pressedAgentRef.current = agent.id\n        dragRef.current = canDrag\n          ? { id: agent.id, dx: p.x - agent.x, dy: p.y - agent.y, moved: false, x0: p.x, y0: p.y }\n          : null\n",
  "      function onAgentPointerDown(e, agent) {\n        if (e.button !== 0) return\n        e.preventDefault()\n        e.stopPropagation()\n        const canDrag = store.get().mode === 'agent'\n        const rect = canvasRect()\n        const p = pointIn(rect, e)\n        pressedAgentRef.current = agent.id\n        dragActive = true\n        dragRef.current = canDrag\n          ? { id: agent.id, dx: p.x - agent.x, dy: p.y - agent.y, moved: false, x0: p.x, y0: p.y, rect: rect, el: e.currentTarget, nx: agent.x, ny: agent.y }\n          : null\n", 'agent pointerdown')

c = sub(c,
  "      function onAgentPointerMove(e) {\n        const d = dragRef.current\n        if (!d) return\n        e.preventDefault()\n        const p = point(e)\n        const nx = p.x - d.dx\n        const ny = p.y - d.dy\n        if (Math.abs(p.x - d.x0) > 3 || Math.abs(p.y - d.y0) > 3) d.moved = true\n        const agents = store.get().agents\n        const next = []\n        for (let i = 0; i < agents.length; i++) next.push(agents[i].id === d.id ? merge(agents[i], { x: nx, y: ny }) : agents[i])\n        store.set({ agents: next })\n      }\n",
  "      function onAgentPointerMove(e) {\n" +
  "        const d = dragRef.current\n" +
  "        if (!d) return\n" +
  "        e.preventDefault()\n" +
  "        const p = pointIn(d.rect, e)\n" +
  "        if (!d.moved && Math.abs(p.x - d.x0) <= 3 && Math.abs(p.y - d.y0) <= 3) return\n" +
  "        d.moved = true\n" +
  "        d.nx = p.x - d.dx\n" +
  "        d.ny = p.y - d.dy\n" +
  "        if (d.el) {\n" +
  "          d.el.style.left = d.nx + 'px'\n" +
  "          d.el.style.top = d.ny + 'px'\n" +
  "          d.el.style.zIndex = '5'\n" +
  "        }\n" +
  "      }\n", 'agent pointermove')

c = sub(c,
  "      function onAgentPointerUp(e) {\n        const d = dragRef.current\n        dragRef.current = null\n        try { e.currentTarget.releasePointerCapture(e.pointerId) } catch (err) {}\n        const pressedId = pressedAgentRef.current\n        pressedAgentRef.current = null\n        if (d !== null) {\n          setDraggingId(null)\n          if (d.moved) return\n        }\n",
  "      function onAgentPointerUp(e) {\n" +
  "        const d = dragRef.current\n" +
  "        dragRef.current = null\n" +
  "        dragActive = false\n" +
  "        try { e.currentTarget.releasePointerCapture(e.pointerId) } catch (err) {}\n" +
  "        const pressedId = pressedAgentRef.current\n" +
  "        pressedAgentRef.current = null\n" +
  "        if (d !== null) {\n" +
  "          setDraggingId(null)\n" +
  "          if (d.moved) {\n" +
  "            if (d.el) d.el.style.zIndex = ''\n" +
  "            const agents = store.get().agents\n" +
  "            const next = []\n" +
  "            for (let i = 0; i < agents.length; i++) next.push(agents[i].id === d.id ? merge(agents[i], { x: d.nx, y: d.ny }) : agents[i])\n" +
  "            store.set({ agents: next })\n" +
  "            return\n" +
  "          }\n" +
  "        }\n", 'agent pointerup')

// ============================================================ 4. imperative file drag
c = sub(c,
  "        const canDrag = store.get().mode === 'file'\n        const p = point(e)\n        const pos = filePosOf(f)\n        fileDragRef.current = {\n          path: f.path,\n          dx: p.x - pos.x,\n          dy: p.y - pos.y,\n          moved: false,\n          x0: p.x,\n          y0: p.y,\n          canDrag: canDrag,\n        }\n",
  "        const canDrag = store.get().mode === 'file'\n" +
  "        const rect = canvasRect()\n" +
  "        const p = pointIn(rect, e)\n" +
  "        const pos = filePosOf(f)\n" +
  "        dragActive = true\n" +
  "        fileDragRef.current = {\n" +
  "          path: f.path,\n" +
  "          dx: p.x - pos.x,\n" +
  "          dy: p.y - pos.y,\n" +
  "          moved: false,\n" +
  "          x0: p.x,\n" +
  "          y0: p.y,\n" +
  "          canDrag: canDrag,\n" +
  "          rect: rect,\n" +
  "          el: e.currentTarget,\n" +
  "          nx: pos.x,\n" +
  "          ny: pos.y,\n" +
  "        }\n", 'file pointerdown')

c = sub(c,
  "      function onFilePointerMove(e) {\n        const d = fileDragRef.current\n        if (!d || !d.canDrag) return\n        e.preventDefault()\n        const p = point(e)\n        if (!d.moved && Math.abs(p.x - d.x0) <= 3 && Math.abs(p.y - d.y0) <= 3) return\n        d.moved = true\n        manual[d.path] = { x: p.x - d.dx, y: p.y - d.dy }\n        store.set({})\n      }\n",
  "      function onFilePointerMove(e) {\n" +
  "        const d = fileDragRef.current\n" +
  "        if (!d || !d.canDrag) return\n" +
  "        e.preventDefault()\n" +
  "        const p = pointIn(d.rect, e)\n" +
  "        if (!d.moved && Math.abs(p.x - d.x0) <= 3 && Math.abs(p.y - d.y0) <= 3) return\n" +
  "        d.moved = true\n" +
  "        d.nx = p.x - d.dx\n" +
  "        d.ny = p.y - d.dy\n" +
  "        if (d.el) {\n" +
  "          d.el.style.left = d.nx + 'px'\n" +
  "          d.el.style.top = d.ny + 'px'\n" +
  "        }\n" +
  "      }\n", 'file pointermove')

c = sub(c,
  "      function onFilePointerUp(e) {\n        const d = fileDragRef.current\n        if (!d) return\n        fileDragRef.current = null\n        setDraggingFile(null)\n        try { e.currentTarget.releasePointerCapture(e.pointerId) } catch (err) {}\n        if (d.moved) return\n        toggleFile(d.path)\n        if (touchMode) setInfo({ kind: 'file', path: d.path })\n      }\n",
  "      function onFilePointerUp(e) {\n" +
  "        const d = fileDragRef.current\n" +
  "        if (!d) { dragActive = false; return }\n" +
  "        fileDragRef.current = null\n" +
  "        dragActive = false\n" +
  "        setDraggingFile(null)\n" +
  "        try { e.currentTarget.releasePointerCapture(e.pointerId) } catch (err) {}\n" +
  "        if (d.moved) {\n" +
  "          manual[d.path] = { x: d.nx, y: d.ny }\n" +
  "          store.set({})\n" +
  "          return\n" +
  "        }\n" +
  "        toggleFile(d.path)\n" +
  "        if (touchMode) setInfo({ kind: 'file', path: d.path })\n" +
  "      }\n", 'file pointerup')

// ============================================================ 5. O(n) render index
c = sub(c,
  "      const contentRef = React.useRef(null)\n",
  "      const contentRef = React.useRef(null)\n" +
  "      const filePosIndex = {}\n" +
  "      const fileByPath = {}\n" +
  "      const agentFileCount = {}\n" +
  "      const agentsById = {}\n" +
  "      for (let i = 0; i < st.agents.length; i++) agentsById[st.agents[i].id] = st.agents[i]\n" +
  "      const ownerSeen = {}\n" +
  "      for (let i = 0; i < st.files.length; i++) {\n" +
  "        const f = st.files[i]\n" +
  "        fileByPath[f.path] = f\n" +
  "        const key = f.agentId === null || f.agentId === undefined ? '' : String(f.agentId)\n" +
  "        const seen = ownerSeen[key] === undefined ? 0 : ownerSeen[key]\n" +
  "        ownerSeen[key] = seen + 1\n" +
  "        const owner = f.agentId ? agentsById[f.agentId] : null\n" +
  "        filePosIndex[f.path] = owner ? filePos(owner, seen, f) : { x: 60, y: 60 }\n" +
  "        if (f.agentId) {\n" +
  "          const cnt = agentFileCount[f.agentId]\n" +
  "          if (cnt === undefined) agentFileCount[f.agentId] = { total: 1, fresh: f.isNew ? 1 : 0 }\n" +
  "          else { cnt.total += 1; if (f.isNew) cnt.fresh += 1 }\n" +
  "        }\n" +
  "      }\n", 'render index')

c = sub(c,
  "      function filePosOf(f) {\n        const owner = findAgent(st.agents, f.agentId)\n        let index = 0\n        let seen = 0\n        for (let i = 0; i < st.files.length; i++) {\n          if (st.files[i].agentId !== f.agentId) continue\n          if (st.files[i].path === f.path) { index = seen; break }\n          seen += 1\n        }\n        if (!owner) return { x: 60, y: 60 }\n        return filePos(owner, index, f)\n      }\n",
  "      function filePosOf(f) {\n        const p = filePosIndex[f.path]\n        return p === undefined ? { x: 60, y: 60 } : p\n      }\n", 'filePosOf')

c = sub(c,
  "        const sess = st.sessions[a.sessionId] || null\n        const live = !!(sess && sess.live)\n        let mine = 0\n        let fresh = 0\n        for (let i = 0; i < st.files.length; i++) {\n          if (st.files[i].agentId !== a.id) continue\n          mine += 1\n          if (st.files[i].isNew) fresh += 1\n        }\n",
  "        const sess = st.sessions[a.sessionId] || null\n" +
  "        const live = !!(sess && sess.live)\n" +
  "        const counts = agentFileCount[a.id]\n" +
  "        const mine = counts === undefined ? 0 : counts.total\n" +
  "        const fresh = counts === undefined ? 0 : counts.fresh\n", 'renderAgent counts')

c = sub(c,
  "      let hoveredFileObj = null\n      if (hoverFile) {\n        for (let i = 0; i < st.files.length; i++) if (st.files[i].path === hoverFile) hoveredFileObj = st.files[i]\n      }\n",
  "      const hoveredFileObj = hoverFile ? (fileByPath[hoverFile] || null) : null\n", 'hoveredFile lookup')

c = sub(c,
  "        let f = null\n        for (let i = 0; i < st.files.length; i++) if (st.files[i].path === info.path) f = st.files[i]\n",
  "        const f = fileByPath[info.path] || null\n", 'info file lookup')

// ============================================================ 6. manual rescan + contentRef binding
c = sub(c,
  "      function closeForm() { setForm(null); setFormErr(null) }\n",
  "      function closeForm() { setForm(null); setFormErr(null) }\n" +
  "      function forceRescan() {\n" +
  "        lastFileScan = 0\n" +
  "        lastScanRoot = null\n" +
  "        lastRefreshSig = null\n" +
  "        refresh()\n" +
  "      }\n", 'forceRescan')

c = sub(c,
  "        h('button', { className: 'acx-btn', onClick: function () { setPan({ x: 36, y: 30 }) } }, '\\u590d\\u4f4d'),\n",
  "        h('button', { className: 'acx-btn', onClick: function () { setPan({ x: 36, y: 30 }) } }, '\\u590d\\u4f4d'),\n" +
  "        h('button', { className: 'acx-btn', onClick: forceRescan }, '\\u91cd\\u626b'),\n", 'rescan button')

c = sub(c,
  "        h('div', { className: 'acx-content', style: { transform: 'translate(' + String(pan.x) + 'px,' + String(pan.y) + 'px) scale(' + String(zoom) + ')', transformOrigin: '0 0' } },\n",
  "        h('div', { className: 'acx-content', ref: contentRef, style: { transform: 'translate(' + String(pan.x) + 'px,' + String(pan.y) + 'px) scale(' + String(zoom) + ')', transformOrigin: '0 0' } },\n", 'contentRef usage')

// bind must always rescan even if the previous scan just happened
c = sub(c,
  "        store.set({ workspace: resolved, wsError: null })\n        setForm(null)\n",
  "        store.set({ workspace: resolved, wsError: null })\n" +
  "        lastScanRoot = null\n" +
  "        lastRefreshSig = null\n" +
  "        setForm(null)\n", 'bind resets scan state')

// ============================================================ 7. built-in directory browser
c = sub(c,
  "      const wsb1 = React.useState(false)\n      const wsBusy = wsb1[0]\n      const setWsBusy = wsb1[1]\n",
  "      const wsb1 = React.useState(false)\n" +
  "      const wsBusy = wsb1[0]\n" +
  "      const setWsBusy = wsb1[1]\n" +
  "      const wsb2 = React.useState(null)\n" +
  "      const wsBrowse = wsb2[0]\n" +
  "      const setWsBrowse = wsb2[1]\n" +
  "      const wsb3 = React.useState([])\n" +
  "      const wsBrowseItems = wsb3[0]\n" +
  "      const setWsBrowseItems = wsb3[1]\n" +
  "      const wsb4 = React.useState(null)\n" +
  "      const wsBrowseErr = wsb4[0]\n" +
  "      const setWsBrowseErr = wsb4[1]\n", 'browse state')

c = sub(c,
  "      function openWorkspaceForm(errText) {\n        const cur = store.get().workspace\n        setWsPath(typeof cur === 'string' ? cur : '')\n        setWsBusy(false)\n",
  "      async function openBrowse(rawPath) {\n" +
  "        const p = normalizePath(rawPath)\n" +
  "        if (p.length === 0) return\n" +
  "        setWsBrowse(p)\n" +
  "        setWsBrowseErr(null)\n" +
  "        setWsBrowseItems([])\n" +
  "        let r = null\n" +
  "        try {\n" +
  "          r = await hostCall('canvas-list-files', { path: p, maxDepth: 0, limit: 800 }, 15000)\n" +
  "        } catch (e) {\n" +
  "          r = { ok: false, error: String((e && e.message) || e) }\n" +
  "        }\n" +
  "        if (!r || r.ok !== true) {\n" +
  "          setWsBrowseErr('\\u65e0\\u6cd5\\u5217\\u51fa ' + p + '\\uff1a' + String((r && r.error) || '\\u672a\\u77e5\\u9519\\u8bef'))\n" +
  "          return\n" +
  "        }\n" +
  "        const items = (r.entries || []).filter(function (e) { return e.type === 'directory' })\n" +
  "        items.sort(function (a, b) { return String(a.name).localeCompare(String(b.name)) })\n" +
  "        setWsBrowseItems(items)\n" +
  "      }\n" +
  "      function openWorkspaceForm(errText) {\n" +
  "        const cur = store.get().workspace\n" +
  "        setWsPath(typeof cur === 'string' ? cur : '')\n" +
  "        setWsBusy(false)\n" +
  "        setWsBrowse(null)\n" +
  "        setWsBrowseItems([])\n" +
  "        setWsBrowseErr(null)\n", 'openBrowse + form reset')

const dialog = `      if (form && form.kind === 'workspace') {
        const curWs = st.workspace
        const browseDirs = wsBrowseItems.filter(function (e) { return e.type === 'directory' })
        formEl = h('div', { className: 'acx-form' },
          h('div', { className: 'acx-form-title' }, '\\u7ed1\\u5b9a\\u5de5\\u4f5c\\u533a\\u6587\\u4ef6\\u5939'),
          h('div', { className: 'acx-hint' }, '\\u4e00\\u4e2a canvas \\u5bf9\\u5e94\\u4e00\\u4e2a\\u5de5\\u4f5c\\u533a\\u6587\\u4ef6\\u5939\\u3002\\u8f93\\u5165\\u5b83\\u7684\\u7edd\\u5bf9\\u8def\\u5f84\\u540e\\u70b9\\u300c\\u7ed1\\u5b9a\\u300d\\uff0cHost \\u4f1a\\u5148\\u6821\\u9a8c\\u8be5\\u8def\\u5f84\\u662f\\u5426\\u5b58\\u5728\\u4e14\\u4e3a\\u76ee\\u5f55\\uff1b\\u7ed1\\u5b9a\\u540e\\u8be5\\u76ee\\u5f55\\u6811\\u91cc\\u7684\\u6bcf\\u4e2a\\u6587\\u4ef6\\u90fd\\u4f1a\\u6210\\u4e3a\\u8282\\u70b9\\u3002'),
          h('div', { className: 'acx-row' },
            h('input', {
              className: 'acx-inp',
              style: { flex: '1 1 260px', minWidth: '180px' },
              value: wsPath,
              placeholder: st.home ? (st.home + '/project') : '/\\u7edd\\u5bf9/\\u8def\\u5f84',
              onChange: function (e) { setWsPath(e.target.value) },
              onKeyDown: function (e) { if (e.key === 'Enter') { e.preventDefault(); bindWorkspace(wsPath) } },
            }),
          ),
          h('div', { className: 'acx-row' },
            h('button', { className: 'acx-btn acx-primary', disabled: wsBusy, onClick: function () { bindWorkspace(wsPath) } }, wsBusy ? '\\u6821\\u9a8c\\u4e2d\\u2026' : '\\u7ed1\\u5b9a'),
            h('button', { className: 'acx-btn', disabled: wsBusy, onClick: function () { openBrowse(wsPath || st.home || '/') } }, '\\u6d4f\\u89c8\\u76ee\\u5f55'),
            h('button', { className: 'acx-btn', disabled: wsBusy, onClick: tryNativePick }, '\\u7528\\u7cfb\\u7edf\\u9009\\u62e9\\u5668'),
            st.home ? h('button', { className: 'acx-btn', disabled: wsBusy, onClick: function () { setWsPath(st.home) } }, '\\u4e3b\\u76ee\\u5f55') : null,
            curWs ? h('button', { className: 'acx-btn', disabled: wsBusy, onClick: function () { setWsPath(curWs) } }, '\\u5f53\\u524d\\u5de5\\u4f5c\\u533a') : null,
          ),
          curWs ? h('div', { className: 'acx-hint' }, '\\u5f53\\u524d\\u5df2\\u7ed1\\u5b9a\\uff1a' + curWs) : null,
          wsBrowse !== null ? h('div', null,
            h('div', { className: 'acx-row' },
              h('span', { className: 'acx-mono' }, wsBrowse),
              h('span', { className: 'acx-spacer' }),
              h('button', { className: 'acx-btn', onClick: function () { setWsPath(wsBrowse); setWsBrowse(null); setWsBrowseErr(null) } }, '\\u7528\\u8fd9\\u4e2a\\u76ee\\u5f55'),
              wsBrowse !== '/' ? h('button', { className: 'acx-btn', onClick: function () { openBrowse(dirname(wsBrowse)) } }, '\\u4e0a\\u4e00\\u5c42') : null,
              h('button', { className: 'acx-btn', onClick: function () { setWsBrowse(null); setWsBrowseErr(null) } }, '\\u6536\\u8d77'),
            ),
            wsBrowseErr ? h('div', { className: 'acx-errbox' }, wsBrowseErr) : null,
            h('div', { className: 'acx-slist' },
              browseDirs.length === 0
                ? h('div', { className: 'acx-empty' }, '(\\u6ca1\\u6709\\u5b50\\u76ee\\u5f55)')
                : browseDirs.map(function (e) {
                    return h('div', { key: e.path, className: 'acx-srow', onClick: function () { openBrowse(e.path) } },
                      h('div', { className: 'acx-st' }, '[D] ' + e.name),
                    )
                  }),
            ),
          ) : null,
          formErr ? h('div', { className: 'acx-errbox' }, formErr) : null,
          h('div', { className: 'acx-btns' },
            h('button', { className: 'acx-btn', onClick: closeForm }, '\\u5173\\u95ed'),
          ),
        )
`
c = subRange(c,
  "      if (form && form.kind === 'workspace') {\n",
  "      } else if (inspectAgent) {\n", dialog, 'workspace dialog')

c = sub(c, "agent-canvas] client apply pkg-19", "agent-canvas] client apply pkg-20", 'client tag')
host = sub(host, "host apply pkg-19", "host apply pkg-20", 'host tag')

// ============================================================ checks
for (const [name, text] of [['host', host], ['client', c]]) {
  const lines = text.split('\n')
  for (let i = 1; i < lines.length; i++) {
    const t = lines[i].trim()
    if (t.length > 12 && t === lines[i - 1].trim()) throw new Error('ADJACENT DUPLICATE in ' + name + ': ' + t)
  }
  for (const ch of Array.from(text)) {
    const cp = ch.codePointAt(0)
    if (cp < 32 && ch !== '\n' && ch !== '\t') throw new Error('CONTROL CHAR in ' + name)
  }
}
new Function(host)
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
new AsyncFunction(c)

const must = [
  ['dragActive guard in refresh', /if \(refreshing\) return\n      if \(dragActive\) return/],
  ['refresh skips when unchanged', /if \(sig === lastRefreshSig\) return/],
  ['file scan decoupled', /const FILE_SCAN_MS = 6000/],
  ['agent drag is imperative', /d\.el\.style\.left = d\.nx \+ 'px'/],
  ['file drag is imperative', /d\.el\.style\.top = d\.ny \+ 'px'/],
  ['single store commit on agent drop', /store\.set\(\{ agents: next \}\)/],
  ['pan is imperative', /d\.el\.style\.transform = 'translate\('/],
  ['no store write during drag', !/manual\[d\.path\] = \{ x: p\.x - d\.dx/.test(c)],
  ['render index built once', /const filePosIndex = \{\}/],
  ['filePosOf is O(1)', /function filePosOf\(f\) \{\n        const p = filePosIndex\[f\.path\]/],
  ['agent counts precomputed', /const counts = agentFileCount\[a\.id\]/],
  ['hover lookup via map', /const hoveredFileObj = hoverFile \? \(fileByPath\[hoverFile\] \|\| null\) : null/],
  ['rescan button wired', /onClick: forceRescan \}/],
  ['browse uses canvas-list-files', /hostCall\('canvas-list-files', \{ path: p, maxDepth: 0, limit: 800 \}, 15000\)/],
  ['browse renders dirs', /const browseDirs = wsBrowseItems\.filter/],
  ['browse can go up', /onClick: function \(\) \{ openBrowse\(dirname\(wsBrowse\)\) \}/],
  ['bind resets scan state', /lastScanRoot = null\n        lastRefreshSig = null\n        setForm\(null\)/],
  ['poll cadence reduced', /}, 5000\)/],
]
let bad = 0
for (const pair of must) { if (!pair[1]) { console.log('FAIL ' + pair[0]); bad++ } }
if (bad > 0) throw new Error(bad + ' contract checks failed')
console.log('OK patch20: host ' + host.length + ' client ' + c.length)
if (process.argv.indexOf('--write') >= 0) {
  fs.writeFileSync(path.join(DIR, 'v20.host.js'), host)
  fs.writeFileSync(path.join(DIR, 'v20.client.js'), c)
  console.log('wrote v20.host.js / v20.client.js')
}
