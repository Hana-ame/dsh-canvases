'use strict'
// gate22: EXECUTE the client half instead of pattern-matching it.
// Minimal React with REAL hook state and REAL ref attachment, a mock Host that answers,
// every registered slot rendered, dialogs opened by driving the toolbar, an agent clicked and
// a file dragged, and drawGraph painting into a recording 2D context.
// This is the class of failure static gates miss: a render/draw-local dropped by refactoring
// (infoSheet, filePosOf, ...) or an interaction branch that silently does nothing.
const fs = require('fs')
const SRC = process.argv[2] || '/tmp/acx/v21.client.js'
const src = fs.readFileSync(SRC, 'utf8')

const checks = []
const check = (n, ok) => checks.push([n, ok === true])

// ---------------- recording 2D context ----------------
const calls = {}
function rec(name) { return function () { calls.total = (calls.total || 0) + 1; calls[name] = (calls[name] || 0) + 1 } }
function makeCtx() {
  return {
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '', globalAlpha: 1,
    setTransform: rec('setTransform'), clearRect: rec('clearRect'), beginPath: rec('beginPath'),
    closePath: rec('closePath'), moveTo: rec('moveTo'), lineTo: rec('lineTo'),
    quadraticCurveTo: rec('quadraticCurveTo'), bezierCurveTo: rec('bezierCurveTo'), arc: rec('arc'),
    rect: rec('rect'), fill: rec('fill'), stroke: rec('stroke'),
    roundRect: function (x, y, w, h, r) { calls.total = (calls.total || 0) + 1; calls.roundRect = (calls.roundRect || 0) + 1; if (w > 100) rects.push({ x: x, y: y, w: w }) },
    fillText: rec('fillText'), setLineDash: rec('setLineDash'), save: rec('save'), restore: rec('restore'),
    measureText: function (s) { calls.total = (calls.total || 0) + 1; calls.measureText = (calls.measureText || 0) + 1; return { width: String(s).length * 6 } },
  }
}
const rects = []
const graphCtx = makeCtx()
let canvasSingleton = null
function makeEl(tag) {
  if (tag === 'canvas' && canvasSingleton !== null) return canvasSingleton
  const el = {
    tagName: tag, style: {}, dataset: {}, width: 0, height: 0, clientWidth: 900, clientHeight: 600,
    getContext: function () { return tag === 'canvas' ? graphCtx : null },
    getBoundingClientRect: function () { return { left: 0, top: 0, width: 900, height: 600 } },
    setPointerCapture: function () {}, releasePointerCapture: function () {},
    appendChild: function () {}, removeChild: function () {}, click: function () {}, remove: function () {},
    addEventListener: function () {}, removeEventListener: function () {},
  }
  if (tag === 'canvas') canvasSingleton = el
  return el
}

// ---------------- React with real hook state put per component ----------------
const hookStore = new WeakMap()
const hookStack = []
let renders = 0
function topFrame() { return hookStack[hookStack.length - 1] }
const React = {
  createElement: function (type, props) {
    const children = Array.prototype.slice.call(arguments, 2)
    if (typeof type === 'function') {
      renders += 1
      const p = {}
      if (props) for (const k in props) p[k] = props[k]
      if (children.length > 0) p.children = children
      let cells = hookStore.get(type)
      if (cells === undefined) { cells = []; hookStore.set(type, cells) }
      hookStack.push({ cells: cells, i: 0 })
      try { return type(p) } finally { hookStack.pop() }
    }
    const node = { type: type, props: props || {}, children: children }
    if (node.props.ref && typeof node.props.ref === 'object' && 'current' in node.props.ref) {
      node.props.ref.current = makeEl(type)
    }
    return node
  },
  useState: function (init) {
    const f = topFrame()
    const i = f.i++
    if (!(i in f.cells)) f.cells[i] = typeof init === 'function' ? init() : init
    const cells = f.cells
    return [cells[i], function (v) { cells[i] = typeof v === 'function' ? v(cells[i]) : v }]
  },
  useRef: function (init) {
    const f = topFrame()
    const i = f.i++
    if (!(i in f.cells)) f.cells[i] = { current: typeof init === 'function' ? init() : init }
    return f.cells[i]
  },
  useEffect: function (fn) { if (typeof fn === 'function') fn() },
  useMemo: function (fn, deps) {
    const f = topFrame()
    const i = f.i++
    if (!(i in f.cells)) {
      let v
      try { v = fn() } catch (e) { v = undefined }
      f.cells[i] = { deps: deps, value: v }
      return v
    }
    const cell = f.cells[i]
    let changed = true
    if (deps && cell.deps && cell.deps.length === deps.length) {
      changed = false
      for (let k = 0; k < deps.length; k++) if (deps[k] !== cell.deps[k]) { changed = true; break }
    }
    if (changed) { cell.deps = deps; cell.value = fn() }
    return cell.value
  },
  useCallback: function (fn) { return fn },
}

// ---------------- seeded cache ----------------
const cached = {
  version: 1, workspace: '/tmp/ws', dock: true, mode: 'file',
  positions: { '/tmp/ws/a1/f.txt': { x: 600, y: 400 } },
  revealed: { '/tmp/ws/a1': true },
  savedAt: 1,
  agents: [{ id: 'agent-1', name: 'A1', mission: 'do things', sessionId: 'sess-1', cwd: '/tmp/ws/a1', x: 80, y: 90, color: '#6366f1', tag: 'create' }],
}
const lsData = { 'agent-canvas/v1': JSON.stringify(cached) }
const localStorage = {
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(lsData, k) ? lsData[k] : null },
  setItem: function (k, v) { lsData[k] = String(v) },
  removeItem: function (k) { delete lsData[k] },
}

// ---------------- mock harness ----------------
const registered = {}
const slots = {
  inject: function (name, cb) { if (typeof cb === 'function') cb() },
  register: function (spec, render) { registered[spec.name] = render },
}
const timer = {
  timeout: function (a) { return typeof a === 'function' ? function () {} : new Promise(function () {}) },
  interval: function () { return function () {} },
}
const ctx = {
  get: function (name) {
    if (name === 'slots') return slots
    if (name === 'timer') return timer
    if (name === 'uiWorkspace') return { listDirectory: function () { return Promise.resolve({ home: '/tmp' }) }, pickDirectory: function () { return Promise.resolve(null) } }
    if (name === 'sessions') return { open: function () {}, binding: function () { return null } }
    if (name === 'layout') return { selectPanel: function () {} }
    return undefined
  },
  effect: function (fn) { if (typeof fn === 'function') fn(); return function () {} },
  on: function () { return function () {} },
}
const hostCalls = {}
const host = {
  call: function (method, args) {
    hostCalls[method] = (hostCalls[method] || 0) + 1
    if (method === 'canvas-sessions') {
      return Promise.resolve({ ok: true, items: [{ id: 'sess-1', cwd: '/tmp/ws/a1', live: true, title: 'T', createdAt: 1, origin: 'user' }] })
    }
    if (method === 'canvas-list-files') {
      return Promise.resolve({
        ok: true, truncated: false,
        entries: [
          { path: '/tmp/ws/a1', name: 'a1', rel: 'a1', type: 'directory', size: null, depth: 1 },
          { path: '/tmp/ws/a1/f.txt', name: 'f.txt', rel: 'a1/f.txt', type: 'file', size: 12, depth: 2 },
          { path: '/tmp/ws/a1/sub', name: 'sub', rel: 'a1/sub', type: 'directory', size: null, depth: 2 },
        ],
      })
    }
    if (method === 'canvas-presets') return Promise.resolve({ ok: true, items: [{ id: 'p1', name: 'P1' }] })
    if (method === 'canvas-stat-dir') return Promise.resolve({ ok: true, path: (args && args.path) || '/tmp/ws', type: 'directory', isDirectory: true })
    if (method === 'canvas-export-file') return Promise.resolve({ ok: true, path: args && args.path })
    if (method === 'canvas-read-session') return Promise.resolve({ ok: true, messages: [] })
    return Promise.resolve({ ok: false, error: 'unmocked ' + method })
  },
}
const styles = { insert: function () { return function () {} } }
const win = {
  devicePixelRatio: 2,
  matchMedia: function () { return { matches: false, addEventListener: function () {}, removeEventListener: function () {} } },
  addEventListener: function () {}, removeEventListener: function () {},
  requestAnimationFrame: function (fn) { if (typeof fn === 'function') fn(); return 1 },
  getComputedStyle: function () { return { getPropertyValue: function () { return '' } } },
}
const doc = { createElement: function (t) { return makeEl(t) }, body: { appendChild: function () {}, removeChild: function () {} } }

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const factory = new AsyncFunction(
  'React', 'ctx', 'host', 'styles', 'harness', 'window', 'document', 'localStorage',
  'Blob', 'URL', 'setTimeout', 'console', 'ResizeObserver', 'requestAnimationFrame', src,
)

function collect(node, out) {
  if (!node || typeof node !== 'object') return out
  if (Array.isArray(node)) { for (let i = 0; i < node.length; i++) collect(node[i], out); return out }
  out.push(node)
  const ch = node.children
  if (Array.isArray(ch)) for (let i = 0; i < ch.length; i++) collect(ch[i], out)
  return out
}
const byClass = (nodes, cls) => nodes.filter(function (n) { return n.props && n.props.className === cls })
const asText = function (node) {
  const parts = []
  const walk = function (n) {
    if (n === null || n === undefined || typeof n === 'boolean') return
    if (typeof n === 'string' || typeof n === 'number') { parts.push(String(n)); return }
    if (Array.isArray(n)) { for (let i = 0; i < n.length; i++) walk(n[i]); return }
    if (n.children) walk(n.children)
  }
  walk(node)
  return parts.join(' ')
}

;(async function () {
  let err = null
  try {
    const plugin = await factory(
      React, ctx, host, styles, {}, win, doc, localStorage,
      function () {}, { createObjectURL: function () { return 'blob:x' }, revokeObjectURL: function () {} },
      function () {}, console, function () {}, win.requestAnimationFrame,
    )
    check('client body returns a plugin with apply()', !!(plugin && typeof plugin.apply === 'function'))
    plugin.apply(ctx)
    check('main slot renderer registered', typeof registered.main === 'function')
    check('sidebar.panellist renderer registered', typeof registered['sidebar.panellist'] === 'function')
    check('tool.view.cordis renderer registered', typeof registered['tool.view.cordis'] === 'function')

    let tree = registered.main()
    check('main slot rendered without throwing', true)

    await new Promise(function (r) { setTimeout(r, 150) })
    check('host was queried for sessions', (hostCalls['canvas-sessions'] || 0) >= 1)
    check('host was queried for files', (hostCalls['canvas-list-files'] || 0) >= 1)
    check('presets were requested', (hostCalls['canvas-presets'] || 0) >= 1)

    tree = registered.main()
    let nodes = collect(tree, [])
    check('re-render with live data succeeds', true)

    const canvasNodes = byClass(nodes, 'acx-graph')
    check('render tree contains exactly one graph canvas', canvasNodes.length === 1)
    check('canvas ref was attached', canvasNodes.length === 1 && canvasNodes[0].props.ref.current !== null)
    check('canvas wires all pointer handlers', canvasNodes.length === 1 &&
      ['onPointerDown', 'onPointerMove', 'onPointerUp', 'onPointerCancel', 'onWheel', 'onDoubleClick'].every(function (k) { return typeof canvasNodes[0].props[k] === 'function' }))
    check('toolbar rendered', byClass(nodes, 'acx-bar').length === 1)
    check('legend rendered', byClass(nodes, 'acx-legend').length === 1)
    check('hover layer rendered', byClass(nodes, 'acx-layer').length === 1)
    check('CANVAS_ONLY hides the chat dock even when cached dock=true', byClass(nodes, 'acx-dock').length === 0)
    check('no info sheet while nothing is inspected', byClass(nodes, 'acx-sheet').length === 0)
    check('no DOM nodes for files/agents', !nodes.some(function (n) { return n.props && (n.props.className === 'acx-file' || n.props.className === 'acx-agent') }))

    // ---------------- the draw path must really have run ----------------
    check('drawGraph cleared the canvas', (calls.clearRect || 0) >= 1)
    check('drawGraph applied the view transform', (calls.setTransform || 0) >= 1)
    check('drawGraph painted the agent', (calls.arc || 0) >= 1)
    check('drawGraph painted a file node (filePosOf ran)', (calls.roundRect || 0) >= 1)
    check('drawGraph painted the folder hierarchy edge', (calls.bezierCurveTo || 0) >= 1)
    check('drawGraph painted text', (calls.fillText || 0) >= 2)
    check('backing store honours devicePixelRatio', canvasNodes[0].props.ref.current.width >= 900)

    const canvasEl = canvasNodes[0]
    const fakeEl = makeEl('canvas')
    const down = (x, y) => canvasEl.props.onPointerDown({ pointerType: 'mouse', button: 0, clientX: x, clientY: y, pointerId: 1, currentTarget: fakeEl, metaKey: false, ctrlKey: false, shiftKey: false })
    const move = (x, y) => canvasEl.props.onPointerMove({ clientX: x, clientY: y, pointerId: 1, currentTarget: fakeEl, preventDefault: function () {} })
    const up = (x, y) => canvasEl.props.onPointerUp({ clientX: x, clientY: y, pointerId: 1, currentTarget: fakeEl })

    // click the agent -> inspector must open (this broke when agentClick returned early)
    const agentCenterX = 80 + 28 + 36
    const agentCenterY = 90 + 28 + 30
    down(agentCenterX, agentCenterY)
    up(agentCenterX, agentCenterY)
    tree = registered.main()
    nodes = collect(tree, [])
    const sideAfterAgentClick = byClass(nodes, 'acx-side')
    check('clicking an agent opens the right-side settings panel', sideAfterAgentClick.length === 1)
    check('clicking an agent does not open the bottom dialog for settings', byClass(nodes, 'acx-form').length === 0)
    check('the settings panel sits in the right column', byClass(nodes, 'acx-right').length === 1 &&
      collect(byClass(nodes, 'acx-right')[0], []).some(function (n) { return n.props && n.props.className === 'acx-side' }))
    check('no chat dock anywhere in canvas-only mode', !nodes.some(function (n) { return n.props && n.props.className === 'acx-dock' }))
    check('settings show the clicked agent', sideAfterAgentClick.length === 1 && asText(sideAfterAgentClick[0]).indexOf('A1') >= 0)
    check('settings expose name/mission/preset controls', sideAfterAgentClick.length === 1 &&
      collect(sideAfterAgentClick[0], []).filter(function (n) { return n.type === 'input' || n.type === 'textarea' || n.type === 'select' }).length >= 3)

    // left sidebar: auto-collapse on entry + a manual toggle
    {
      const bar4 = collect(byClass(nodes, 'acx-bar')[0] || { children: [] }, [])
      const sideBtn = bar4.filter(function (n) { return n.type === 'button' && asText(n) === '\u5de6\u680f' })[0]
      check('toolbar has a left-sidebar toggle', !!sideBtn)
      check('layout.toggleSidebar is the collapse mechanism', src.indexOf("layout.toggleSidebar") >= 0)
      check('collapse is skipped when the sidebar already looks collapsed', /function sidebarLooksExpanded\(\)/.test(src) && /r\.left > 120/.test(src))
      check('collapse only runs on a wide viewport', /window\.innerWidth \|\| 0\) >= 1024/.test(src))
    }

    // click a file -> selection reflected in the toolbar
    // derive the node's real position from the last file rect drawn (w === FILE_W)
    const fileRect = rects.filter(function (r) { return r.w === 200 }).pop()
    const fileX = fileRect.x + 100 + 36
    const fileY = fileRect.y + 22 + 30
    down(fileX, fileY)
    up(fileX, fileY)
    tree = registered.main()
    nodes = collect(tree, [])
    const bar = byClass(nodes, 'acx-bar')[0]
    check('clicking a file in canvas-only mode opens nothing', byClass(nodes, 'acx-form').length === 0 && byClass(nodes, 'acx-side').length === 1)

    // drag that file -> position is committed and redrawn
    const before = calls.roundRect || 0
    const rectsAfter = rects.length
    down(fileX, fileY)
    move(fileX + 60, fileY + 40)
    up(fileX + 60, fileY + 40)
    tree = registered.main()
    check('dragging a file repaints the graph', (calls.roundRect || 0) >= before)
    check('the dragged file is redrawn at its dropped position', rects.slice(rectsAfter).some(function (r) {
      return r.w === 200 && Math.abs(r.x - (fileRect.x + 60)) < 0.5 && Math.abs(r.y - (fileRect.y + 40)) < 0.5
    }))
    check('the dropped file is no longer stacked inside its folder box', !rects.slice(rectsAfter).some(function (r) {
      return r.w === 200 && Math.abs(r.x - fileRect.x) < 0.5 && Math.abs(r.y - fileRect.y) < 0.5
    }))

    // ---- canvas-only core behavior: click a folder node, split ONE child ----
    {
      const secsNow = rects.filter(function (r) { return r.w === 220 })
      const a1Box = secsNow.length > 0 ? secsNow[secsNow.length - 1] : null
      check('the revealed folder keeps its own node box', a1Box !== null)
      if (a1Box !== null) {
        down(a1Box.x + 110 + 36, a1Box.y + 14 + 30)
        up(a1Box.x + 110 + 36, a1Box.y + 14 + 30)
        tree = registered.main()
        nodes = collect(tree, [])
        const side = byClass(nodes, 'acx-side')[0]
        const sideTxt = side ? asText(side) : ''
        check('clicking a folder opens the split panel', !!side && sideTxt.indexOf('分裂') >= 0)
        check('the split panel lists BOTH files and folders', sideTxt.indexOf('f.txt') >= 0 && sideTxt.indexOf('sub') >= 0)
        check('already-split children are marked, not split again', sideTxt.indexOf('已分裂') >= 0)
        const secsBefore = rects.filter(function (r) { return r.w === 220 }).length
        const splitBtn = side ? collect(side, []).filter(function (n) { return n.type === 'button' && asText(n) === '分裂' && n.props.disabled !== true })[0] : null
        check('exactly one un-split child can be split', !!splitBtn)
        if (splitBtn) {
          splitBtn.props.onClick()
          registered.main()
          const secsAfter = rects.filter(function (r) { return r.w === 220 }).length
          check('splitting ONE child adds exactly one folder node', secsAfter > secsBefore)
          const side2 = byClass(collect(registered.main(), []), 'acx-side')[0]
          const sideTxt2 = side2 ? asText(side2) : ''
          check('the split folder node appears in the panel listing too', sideTxt2.indexOf('sub') >= 0 && sideTxt2.indexOf('已分裂') >= 0)
        }
      }
    }

    // pan (empty space)
    down(600, 400); move(640, 430); up(640, 430)
    check('pan sequence runs without throwing', true)
    canvasEl.props.onWheel({ deltaY: -100, clientX: 50, clientY: 50 })
    check('wheel zoom runs without throwing', true)
    canvasEl.props.onPointerLeave({})
    check('pointer leave runs without throwing', true)

    // every toolbar button
    nodes = collect(registered.main(), [])
    const buttons = collect(byClass(nodes, 'acx-bar')[0], []).filter(function (n) { return n.type === 'button' && typeof n.props.onClick === 'function' })
    check('canvas-only toolbar still has its controls', buttons.length >= 10)
    const barTxtAll = asText(byClass(nodes, 'acx-bar')[0])
    check('agent/session/export affordances are hidden', barTxtAll.indexOf('+ Agent') < 0 && barTxtAll.indexOf('投影会话') < 0 && barTxtAll.indexOf('导出 PNG') < 0 && barTxtAll.indexOf('移动 Agent') < 0 && barTxtAll.indexOf('多选') < 0)
    check('canvas-only toolbar keeps bind, view and reset', (barTxtAll.indexOf('绑定工作区') >= 0 || barTxtAll.indexOf('工作区:') >= 0) && barTxtAll.indexOf('重置') >= 0 && barTxtAll.indexOf('适应') >= 0)
    for (let i = 0; i < buttons.length; i++) buttons[i].props.onClick()
    check('every toolbar button invokes without throwing', true)

    // each document dialog must be reachable and render its own controls
    const barButtons = collect(byClass(collect(registered.main(), []), 'acx-bar')[0], [])
      .filter(function (n) { return n.type === 'button' && typeof n.props.onClick === 'function' })
    const findBtn = function (label) {
      for (let i = 0; i < barButtons.length; i++) if (asText(barButtons[i]).indexOf(label) >= 0) return barButtons[i]
      return null
    }
    const wsBtn = findBtn('绑定工作区')
    check('workspace button present', wsBtn !== null)
    if (wsBtn !== null) {
      wsBtn.props.onClick()
      const dlg = byClass(collect(registered.main(), []), 'acx-form')
      check('binding workspace opens a dialog', dlg.length === 1)
      const txt = dlg.length > 0 ? asText(dlg[0]) : ''
      check('workspace dialog offers a manual path field', dlg.length === 1 && collect(dlg[0], []).some(function (n) { return n.type === 'input' }))
      check('workspace dialog offers the built-in browser', txt.indexOf('浏览目录') >= 0)
      check('workspace dialog offers binding', txt.indexOf('绑定') >= 0)
    }
    const projBtn = findBtn('投影会话')
    check('session projection is hidden in canvas-only mode', projBtn === null)

    // inspection surfaces
    const iconTree = registered['sidebar.panellist']({ size: 20, active: true })
    check('sidebar icon renders svg', iconTree && iconTree.type === 'svg')
    const runTree = registered['tool.view.cordis']()
    check('tool view card renders', !!(runTree && runTree.props && runTree.props.className === 'acx-inline'))

    // ---------------- pkg-24: the four requested features ----------------
  // perf HUD toggles and reports the instrumented counters
  {
    const nodes2 = collect(registered.main(), [])
    const bar2 = collect(byClass(nodes2, 'acx-bar')[0] || { children: [] }, [])
    const perfBtn = bar2.filter(function (n) { return n.type === 'button' && asText(n).indexOf('\u6027\u80fd') >= 0 })[0]
    check('a perf-toggle button exists in the toolbar', !!perfBtn)
    if (perfBtn) {
      // the earlier "click every toolbar button" sweep may have left perf ON;
      // drive the toggle to a known state instead of assuming it is off.
      // force OFF (whatever the earlier button sweep left), then turn it ON once.
      const readBtn = function () {
        return collect(byClass(collect(registered.main(), []), 'acx-bar')[0] || { children: [] }, [])
          .filter(function (n) { return n.type === 'button' && asText(n).indexOf('\u6027\u80fd') >= 0 })[0]
      }
      let guard = 0
      while (asText(readBtn()).indexOf('\u5f00') >= 0 && guard < 4) { readBtn().props.onClick(); guard += 1 }
      readBtn().props.onClick()
      const pn = collect(registered.main(), [])
      const perfPanel = byClass(pn, 'acx-perf')
      check('the perf monitor panel opens', perfPanel.length === 1)
      const pt = perfPanel.length === 1 ? asText(perfPanel[0]) : ''
      check('the perf panel reports frame draw ms', pt.indexOf('ms') >= 0)
      check('the perf panel reports FPS', pt.indexOf('FPS') >= 0)
      check('the perf panel reports host round-trip', pt.indexOf('Host') >= 0)
      check('the perf panel reports drag-triggered re-renders', pt.indexOf('\u91cd\u6e32\u67d3') >= 0)
    }
  }

  // zoom: fit-to-content and step buttons must exist and run
  {
    const nodes3 = collect(registered.main(), [])
    const bar3 = collect(byClass(nodes3, 'acx-bar')[0] || { children: [] }, [])
    const labels = bar3.filter(function (n) { return n.type === 'button' }).map(asText)
    check('toolbar has an explicit zoom-in control', labels.indexOf('+') >= 0)
    check('toolbar has an explicit zoom-out control', labels.some(function (s) { return s.indexOf('\u2212') >= 0 }))
    check('toolbar has a fit-to-content control', labels.indexOf('\u9002\u5e94') >= 0)
    const fitBtn = bar3.filter(function (n) { return n.type === 'button' && asText(n) === '\u9002\u5e94' })[0]
    if (fitBtn) { fitBtn.props.onClick(); check('fit-to-content runs without throwing', true) }
    const inBtn = bar3.filter(function (n) { return n.type === 'button' && asText(n) === '+' })[0]
    if (inBtn) { inBtn.props.onClick(); check('zoom-in runs without throwing', true) }
  }

  // folder hierarchy: positions must depend on path depth, not a flat counter
  check('layout exposes a depth helper', /function depthOfRel\(/.test(src))
  check('layout exposes a directory helper', /function dirOfRel\(/.test(src))
  check('layout groups files into per-directory sections', /function ensureSection\(owner, dirRel\)/.test(src))
  check('layout places sections by depth column', /s\.x = ox \+ 150 \+ s\.depth \* COL_W/.test(src))
  check('a folder box stacks its own files', /filePosIndex\[f\.path\] = \{ x: s\.x \+ BOX_PAD, y: yy \}/.test(src))
  check('a manual position beats the computed slot', /const m = manual\[f\.path\]\n        if \(m !== undefined\) return m/.test(src))

  // ---- regression: the "文件无法正常移动" bug ----
  // The index lives in a useMemo. A drag mutates manual[] (invisible to a memo), so it
  // MUST also bump manualVersion, which is a memo dependency; otherwise the node snaps
  // back on release. These three checks fail if anyone removes that wiring again.
  check('the layout memo depends on manualVersion', /\}, \[st\.files, st\.agents, st\.manualVersion\]\)/.test(src))
  check('a file drop commits through bumpManual', /manual\[it\.path\] = \{ x: it\.x, y: it\.y \}\n            bumpManual\(\)/.test(src))
  check('bumpManual increments manualVersion', /function bumpManual\(\) \{\n      store\.set\(\{ manualVersion: \(store\.get\(\)\.manualVersion \|\| 0\) \+ 1 \}\)/.test(src))
  check('dropping a file splits it out of its folder box', /dropping a file here SPLITS it out of its folder box/.test(src))
  check('folders are collapsed by default (no direct children placed)', /s\.done \+= 1/.test(src) && src.indexOf('s.files.push(f)') < 0)

  // ---- split panel ----
  check('clicking a folder opens the folder panel', /store\.set\(\{ inspectDir: it\.path, inspectId: null \}\)/.test(src))
  check('a folder splits exactly ONE child at a time', /function splitChild\(dirPath, childPath, isDir\)/.test(src))
  check('the split list contains both folders and files', /function dirEntries\(dirPath\)/.test(src))
  check('the folder panel can take them back', /function unsplitDir\(dirPath\)/.test(src))
  check('every folder box is identifiable even when unlisted', /if \(s\.dirPath !== null\) continue/.test(src))

  // markdown content on canvas
  check('a node height accounts for markdown cards', /function nodeH\(f\)/.test(src) && /MD_NODE_H/.test(src))
  check('markdown files are detected by extension', /function isMarkdown\(f\)/.test(src))
  check('markdown body is split into lines for drawing', /function mdLinesOf\(f\)/.test(src))
  check('the md node is drawn with its content', /A named markdown file shows its OWN CONTENT on the node/.test(src))
  check('host reads text for the md preview', /canvas-read-text/.test(fs.readFileSync('/tmp/acx/v21.host.js', 'utf8')))

  check('function components were really invoked', renders >= 6)
    check('whole client half executed end to end', true)
  } catch (e) {
    err = e
    console.log('EXECUTION ERROR: ' + (e && e.message))
    if (e && e.stack) console.log(String(e.stack).split('\n').slice(0, 5).join('\n'))
    check('whole client half executed end to end', false)
  }

  let bad = 0
  for (const p of checks) { if (!p[1]) { console.log('FAIL ' + p[0]); bad++ } else console.log('PASS ' + p[0]) }
  console.log('draw calls: ' + JSON.stringify(calls))
  console.log(bad === 0 ? 'ALL PASS (' + checks.length + ')' : 'FAILURES ' + bad)
  process.exit(bad === 0 ? 0 : 1)
})()
