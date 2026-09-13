// ============================================================================
// Session Canvas — Client half.
//
// This file is the content of `code.client` for the cordis_define tool: a plain
// JavaScript function body returning a Cordis Plugin. It registers one main
// panel showing the DSH session topology as a graph:
//
//   * a node is one session (ordinary root, fork, or subagent-origin child);
//   * an edge is real DSH lineage — `header.parentSession` — never an invented
//     relation. Fork edges are solid, subagent edges are dashed. Because lineage
//     lives in the durable session headers, the graph rebuilds itself after a
//     DSH restart with no bookkeeping of our own.
//   * ordinary sessions can be driven from the transcript dock (queue / steer /
//     stop / fork); subagent-origin nodes are display-only, because addressing
//     them needs the subagent control channel rather than sessionController.
//
// Plain JavaScript only: no JSX, no imports, no native timers. Timers come from
// the Cordis `timer` service, host calls from `host.call`, styles from
// `styles.insert`.
// ============================================================================

const h = React.createElement
const PANEL_ID = 'session-canvas'
const STAMP = 'sc-1'

const NODE_W = 236
const NODE_H = 58
const COL_GAP = 104
const ROW_GAP = 16
const TREE_GAP = 0.7
const FONT_STACK = 'ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif'
const FONT_FAMILY_MONO = 'ui-monospace,Menlo,monospace'
const FALLBACK = {
  label: '#e8eaed', dim: '#9aa4b2', accent: '#4d6bfe', ok: '#2ea043', warn: '#d29922',
  border: 'rgba(127,127,127,.4)', line: 'rgba(127,127,127,.45)',
  nodeBg: 'rgba(127,127,127,.10)', subBg: 'rgba(127,127,127,.05)', white: '#ffffff',
  fork: '#6366f1', sub: '#8b5cf6', bad: '#ef4444',
}

const CSS = [
  '.sc-root{position:relative;flex:1 1 auto;height:100%;min-height:0;width:100%;overflow:hidden;background:var(--dsw-alias-bg-base,transparent);color:var(--dsw-alias-label-primary,inherit);font-size:13px;line-height:1.45}',
  '.sc-graph{position:absolute;inset:0;z-index:1;display:block;width:100%;height:100%;touch-action:none;cursor:grab;background-color:var(--dsw-alias-bg-base,transparent);background-image:radial-gradient(var(--dsw-alias-border-l1,rgba(127,127,127,.30)) 1px,transparent 1px);background-size:22px 22px}',
  '.sc-graph[data-panning=1]{cursor:grabbing}',
  '.sc-bar{position:absolute;top:8px;left:8px;right:8px;z-index:30;display:flex;align-items:center;gap:6px;padding:6px;border:1px solid var(--dsw-alias-border-l3,rgba(127,127,127,.35));border-radius:12px;background:var(--dsw-alias-button-floating-fill,var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-layer-2,rgba(20,20,24,.86))));flex-wrap:wrap;row-gap:6px;max-height:40%;overflow-x:hidden;overflow-y:auto}',
  '.sc-bar b{font-size:12.5px;font-weight:600;white-space:nowrap;flex:none}',
  '.sc-btn{display:inline-flex;align-items:center;gap:5px;flex:none;border:1px solid var(--dsw-alias-border-l3,rgba(127,127,127,.4));background:var(--dsw-alias-bg-layer-1,transparent);color:var(--dsw-alias-label-primary,inherit);border-radius:8px;padding:4px 10px;font:inherit;font-size:12px;line-height:1.5;cursor:pointer;white-space:nowrap}',
  '.sc-btn:hover:not([disabled]){background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-3,transparent))}',
  '.sc-btn[disabled]{opacity:.45;cursor:default}',
  '.sc-on{background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary,#4d6bfe));border-color:transparent;color:var(--dsw-alias-label-primary-foreground,#fff)}',
  '.sc-danger{color:var(--dsw-alias-state-error-primary,inherit);border-color:var(--dsw-alias-state-error-primary,currentColor)}',
  '.sc-spacer{flex:1 1 auto}',
  '.sc-inp,.sc-sel{background:var(--dsw-alias-bg-layer-1,transparent);color:var(--dsw-alias-label-primary,inherit);border:1px solid var(--dsw-alias-border-l3,rgba(127,127,127,.35));border-radius:8px;padding:5px 8px;font:inherit;font-size:12px;box-sizing:border-box}',
  '.sc-inp{flex:1 1 150px;min-width:0}',
  '.sc-note{font-size:11.5px;color:var(--dsw-alias-label-secondary,inherit);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}',
  '.sc-right{position:absolute;top:64px;right:8px;bottom:8px;z-index:16;width:min(430px,52%);display:flex;flex-direction:column;min-height:0;border:1px solid var(--dsw-alias-border-l3,rgba(127,127,127,.35));border-radius:14px;background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-layer-2,transparent));box-shadow:0 12px 32px rgba(0,0,0,.28);overflow:hidden}',
  '.sc-sheet{position:absolute;left:8px;right:8px;bottom:8px;z-index:24;max-height:58%;overflow:auto;border:1px solid var(--dsw-alias-border-l3,rgba(127,127,127,.35));border-radius:14px;background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-layer-2,transparent));box-shadow:0 12px 32px rgba(0,0,0,.28);padding:12px;font-size:12px;display:flex;flex-direction:column;gap:8px}',
  '.sc-dock-head{display:flex;align-items:center;gap:6px;padding:8px 10px;border-bottom:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.3));font-weight:600;font-size:12.5px;flex:none}',
  '.sc-dock-head .sc-t{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.sc-meta{padding:8px 10px;border-bottom:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.3));font-size:11.5px;display:flex;flex-direction:column;gap:4px;flex:none;max-height:26%;overflow:auto}',
  '.sc-mrow{display:flex;gap:6px;align-items:baseline}',
  '.sc-mk{color:var(--dsw-alias-label-secondary,inherit);flex:none;min-width:56px}',
  '.sc-mv{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.sc-mono{font-family:var(--dsw-font-mono,ui-monospace,Menlo,monospace);font-size:10.5px}',
  '.sc-log{flex:1 1 auto;min-height:0;overflow:auto;padding:10px;display:flex;flex-direction:column;gap:8px}',
  '.sc-msg{border-radius:9px;padding:6px 9px;font-size:12px;white-space:pre-wrap;word-break:break-word;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.3))}',
  '.sc-msg[data-role=user]{background:var(--dsw-alias-bg-layer-1,transparent);align-self:flex-end;max-width:92%}',
  '.sc-msg[data-role=assistant]{background:transparent;max-width:96%}',
  '.sc-msg[data-role=tool]{font-size:11px;color:var(--dsw-alias-label-secondary,inherit);border-style:dashed;max-width:96%}',
  '.sc-msg[data-role=system]{font-size:11px;color:var(--dsw-alias-label-secondary,inherit);border-style:dotted;max-width:96%}',
  '.sc-compose{border-top:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.3));padding:9px;display:flex;flex-direction:column;gap:7px;flex:none}',
  '.sc-row{display:flex;align-items:center;gap:7px;flex-wrap:wrap}',
  '.sc-ta{width:100%;min-height:62px;box-sizing:border-box;resize:vertical;background:var(--dsw-alias-bg-layer-1,transparent);color:var(--dsw-alias-label-primary,inherit);border:1px solid var(--dsw-alias-border-l3,rgba(127,127,127,.35));border-radius:9px;padding:8px;font:inherit;font-size:12.5px}',
  '.sc-res{font-size:11px;display:flex;flex-direction:column;gap:3px;max-height:96px;overflow:auto}',
  '.sc-ok{color:var(--dsw-alias-state-success-primary,#2ea043)}',
  '.sc-bad{color:var(--dsw-alias-state-error-primary,#ef4444)}',
  '.sc-chip{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--dsw-alias-border-l3,rgba(127,127,127,.35));border-radius:999px;padding:1px 8px;font-size:11px;background:var(--dsw-alias-bg-layer-1,transparent);flex:none}',
  '.sc-hud{position:absolute;left:8px;bottom:8px;z-index:26;border:1px solid var(--dsw-alias-border-l3,rgba(127,127,127,.35));border-radius:10px;background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-layer-2,transparent));padding:7px 10px;font-size:11px;font-family:var(--dsw-font-mono,ui-monospace,Menlo,monospace);line-height:1.6;white-space:pre}',
]

// ===========================================================================
// PURE HELPERS (module scope: no ctx here)
// ===========================================================================

function merge(a, b) {
  const out = {}
  for (const k in a) out[k] = a[k]
  for (const k in b) out[k] = b[k]
  return out
}

function clamp(v, lo, hi) {
  if (typeof v !== 'number' || !isFinite(v)) return lo
  return v < lo ? lo : (v > hi ? hi : v)
}

function basename(p) {
  if (typeof p !== 'string' || p.length === 0) return ''
  const t = p.replace(/\/+$/, '')
  const i = t.lastIndexOf('/')
  return i >= 0 ? t.slice(i + 1) : t
}

function shortId(id) {
  const s = String(id === undefined || id === null ? '' : id)
  if (s.length <= 18) return s
  return s.slice(0, 8) + '…' + s.slice(s.length - 4)
}

function fmtTime(ms) {
  if (typeof ms !== 'number' || ms <= 0) return ''
  const d = new Date(ms)
  const pad = (n) => (n < 10 ? '0' + String(n) : String(n))
  return pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
}

function curve(x1, y1, x2, y2) {
  const mx = (x1 + x2) / 2
  return 'M ' + String(x1) + ' ' + String(y1) + ' C ' + String(mx) + ' ' + String(y1) + ', ' + String(mx) + ' ' + String(y2) + ', ' + String(x2) + ' ' + String(y2)
}

function roundRect(g, x, y, w, hh, r) {
  const rr = Math.min(r, w / 2, hh / 2)
  g.beginPath()
  g.moveTo(x + rr, y)
  g.lineTo(x + w - rr, y)
  g.quadraticCurveTo(x + w, y, x + w, y + rr)
  g.lineTo(x + w, y + hh - rr)
  g.quadraticCurveTo(x + w, y + hh, x + w - rr, y + hh)
  g.lineTo(x + rr, y + hh)
  g.quadraticCurveTo(x, y + hh, x, y + hh - rr)
  g.lineTo(x, y + rr)
  g.quadraticCurveTo(x, y, x + rr, y)
  g.closePath()
}

const clipCache = {}
let clipCacheSize = 0
function clipText(g, text, maxW) {
  const s = String(text === undefined || text === null ? '' : text)
  if (s.length === 0) return ''
  const ck = String(g.font) + '|' + String(Math.round(maxW)) + '|' + s
  const hit = clipCache[ck]
  if (hit !== undefined) return hit
  let out = s
  if (g.measureText(s).width > maxW) {
    let lo = 0
    let hi = s.length
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2)
      if (g.measureText(s.slice(0, mid) + '…').width <= maxW) lo = mid
      else hi = mid - 1
    }
    out = s.slice(0, lo) + '…'
  }
  if (clipCacheSize > 4000) {
    for (const k in clipCache) delete clipCache[k]
    clipCacheSize = 0
  }
  clipCache[ck] = out
  clipCacheSize += 1
  return out
}

const CACHE_KEY = 'dsh-session-canvas:v1'
function loadCache() {
  try {
    if (typeof localStorage === 'undefined' || localStorage === null) return null
    const raw = localStorage.getItem(CACHE_KEY)
    if (typeof raw !== 'string' || raw.length === 0) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch (e) {
    return null
  }
}
function saveCache(snapshot) {
  try {
    if (typeof localStorage === 'undefined' || localStorage === null) return false
    localStorage.setItem(CACHE_KEY, JSON.stringify(snapshot))
    return true
  } catch (e) {
    return false
  }
}
function clearCache() {
  try {
    if (typeof localStorage === 'undefined' || localStorage === null) return
    localStorage.removeItem(CACHE_KEY)
  } catch (e) {}
}

// ---------------------------------------------------------------------------
// Graph derivation. Pure: fed the header list, the title map, the filters and
// the manual-position overlay. Produces nodes, lineage edges and index maps.
// A parent outside the visible set makes its child a root of the drawing (the
// lineage is still recorded on the node, so the dock can link to it).
// ---------------------------------------------------------------------------
function buildGraph(items, titles, filters, manual) {
  const q = typeof filters.q === 'string' ? filters.q.trim().toLowerCase() : ''
  const visible = []
  const byId = {}
  for (let i = 0; i < items.length; i++) {
    const s = items[i]
    if (!s || typeof s.id !== 'string') continue
    if (filters.showSub !== true && s.origin === 'subagent') continue
    if (typeof filters.ws === 'string' && filters.ws.length > 0 && filters.ws !== '__all__') {
      if (String(s.cwd || '') !== filters.ws) continue
    }
    if (q.length > 0) {
      const hay = (String(titles[s.id] || '') + ' ' + s.id + ' ' + String(s.cwd || '') + ' ' + String(s.origin || '')).toLowerCase()
      if (hay.indexOf(q) < 0) continue
    }
    byId[s.id] = s
    visible.push(s.id)
  }

  const children = {}
  const known = {}
  for (let i = 0; i < visible.length; i++) known[visible[i]] = true
  for (let i = 0; i < visible.length; i++) {
    const s = byId[visible[i]]
    const p = s.parentId && known[s.parentId] ? s.parentId : null
    if (p === null) continue
    if (children[p] === undefined) children[p] = []
    children[p].push(s.id)
  }

  let keep = null
  if (filters.onlyChildren === true) {
    keep = {}
    for (let i = 0; i < visible.length; i++) {
      const id = visible[i]
      const kids = children[id]
      if (kids !== undefined && kids.length > 0) {
        keep[id] = true
        let up = byId[id].parentId
        let guard = 0
        while (up && known[up] && guard < 64) {
          keep[up] = true
          up = byId[up].parentId
          guard += 1
        }
      }
    }
  }

  const shown = []
  for (let i = 0; i < visible.length; i++) if (keep === null || keep[visible[i]] === true) shown.push(visible[i])

  const shownSet = {}
  for (let i = 0; i < shown.length; i++) shownSet[shown[i]] = true
  const kidsOf = {}
  const roots = []
  for (let i = 0; i < shown.length; i++) {
    const s = byId[shown[i]]
    const p = s.parentId && shownSet[s.parentId] ? s.parentId : null
    if (p === null) roots.push(s.id)
    else {
      if (kidsOf[p] === undefined) kidsOf[p] = []
      kidsOf[p].push(s.id)
    }
  }
  const cmp = (a, b) => {
    const ta = byId[a].createdAt || 0
    const tb = byId[b].createdAt || 0
    if (ta !== tb) return ta - tb
    return a < b ? -1 : (a > b ? 1 : 0)
  }
  roots.sort(cmp)
  for (const k in kidsOf) kidsOf[k].sort(cmp)

  const pos = {}
  const depthOf = {}
  let cursor = 0
  const rowH = NODE_H + ROW_GAP
  function place(id, d) {
    depthOf[id] = d
    const kids = kidsOf[id]
    if (kids === undefined || kids.length === 0) {
      pos[id] = { x: d * (NODE_W + COL_GAP), y: cursor * rowH }
      cursor += 1
      return pos[id].y
    }
    let first = null
    let last = null
    for (let i = 0; i < kids.length; i++) {
      const y = place(kids[i], d + 1)
      if (first === null) first = y
      last = y
    }
    pos[id] = { x: d * (NODE_W + COL_GAP), y: (first + last) / 2 }
    return pos[id].y
  }
  for (let i = 0; i < roots.length; i++) {
    if (i > 0) cursor += TREE_GAP
    place(roots[i], 0)
  }

  if (manual !== null && manual !== undefined) {
    for (const id in manual) {
      if (pos[id] === undefined) continue
      const m = manual[id]
      if (m && typeof m.x === 'number' && typeof m.y === 'number') pos[id] = { x: m.x, y: m.y }
    }
  }

  const nodes = []
  let maxX = 0
  let maxY = 0
  for (let i = 0; i < shown.length; i++) {
    const id = shown[i]
    const s = byId[id]
    const p = pos[id]
    const kids = kidsOf[id]
    const isSub = s.origin === 'subagent'
    nodes.push({
      id: id,
      x: p.x,
      y: p.y,
      title: String(titles[id] || '') || shortId(id),
      hasTitle: typeof titles[id] === 'string' && titles[id].length > 0,
      origin: s.origin,
      kind: isSub ? 'sub' : (s.parentId ? 'fork' : 'root'),
      live: s.live === true,
      cwd: s.cwd,
      createdAt: s.createdAt,
      parentId: s.parentId,
      childCount: kids === undefined ? 0 : kids.length,
      children: kids || [],
      depth: depthOf[id] || 0,
    })
    if (p.x + NODE_W > maxX) maxX = p.x + NODE_W
    if (p.y + NODE_H > maxY) maxY = p.y + NODE_H
  }

  const nodeById = {}
  for (let i = 0; i < nodes.length; i++) nodeById[nodes[i].id] = nodes[i]

  const edges = []
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]
    if (!n.parentId || nodeById[n.parentId] === undefined) continue
    const p = nodeById[n.parentId]
    edges.push({
      from: p.id,
      to: n.id,
      kind: n.origin === 'subagent' ? 'sub' : 'fork',
      x1: p.x + NODE_W,
      y1: p.y + NODE_H / 2,
      x2: n.x,
      y2: n.y + NODE_H / 2,
    })
  }

  return {
    nodes: nodes,
    edges: edges,
    nodeById: nodeById,
    hidden: visible.length - nodes.length,
    total: items.length,
    maxX: maxX,
    maxY: maxY,
  }
}

// ===========================================================================
// PLUGIN
// ===========================================================================

return {
  apply(ctx) {
    const slots = ctx.get('slots')
    if (slots === undefined) {
      console.error('[session-canvas] slots service unavailable; UI not registered')
      return
    }

    const cached = loadCache() || {}
    const cachedFilters = cached.filters && typeof cached.filters === 'object' ? cached.filters : {}

    function createStore(initial) {
      let state = initial
      const listeners = []
      return {
        get: function () { return state },
        set: function (patch) {
          state = merge(state, patch)
          for (let i = 0; i < listeners.length; i++) {
            try { listeners[i]() } catch (e) { console.error('[session-canvas] listener failed', e) }
          }
        },
        subscribe: function (fn) {
          listeners.push(fn)
          return function () {
            const i = listeners.indexOf(fn)
            if (i >= 0) listeners.splice(i, 1)
          }
        },
      }
    }

    const store = createStore({
      items: [],
      titles: {},
      filters: {
        q: typeof cachedFilters.q === 'string' ? cachedFilters.q : '',
        ws: typeof cachedFilters.ws === 'string' ? cachedFilters.ws : '__all__',
        showSub: cachedFilters.showSub !== false,
        onlyChildren: cachedFilters.onlyChildren === true,
      },
      selected: Array.isArray(cached.selected) ? cached.selected.slice(0, 40) : [],
      activeId: typeof cached.active === 'string' ? cached.active : null,
      transcript: null,
      composer: '',
      delivery: 'queue',
      multi: false,
      busy: false,
      results: null,
      error: null,
      note: null,
      info: null,
      scanAt: null,
      zoom: 1,
      manualVersion: 0,
      perfOn: false,
    })

    const manual = {}
    const cachedPositions = cached.positions && typeof cached.positions === 'object' ? cached.positions : {}
    for (const k in cachedPositions) {
      const v = cachedPositions[k]
      if (v && typeof v.x === 'number' && typeof v.y === 'number') manual[k] = { x: v.x, y: v.y }
    }

    const viewRef = { current: { x: 36, y: 30, z: 1 } }
    const cachedView = cached.view && typeof cached.view === 'object' ? cached.view : null
    if (cachedView && typeof cachedView.x === 'number' && typeof cachedView.y === 'number' && typeof cachedView.z === 'number') {
      viewRef.current = { x: cachedView.x, y: cachedView.y, z: clamp(cachedView.z, 0.08, 2.5) }
    }

    let stopped = false
    let disposed = false
    let scanDelay = 2500
    let scanTimer = null
    let lastSig = null
    let heartbeat = 0
    let titlesAt = 0
    let persistTimer = null
    let dragActive = false
    let fitted = cachedView !== null

    // `dragRenders` counts component renders that happened while a drag was in
    // progress. The target is 0: dragging mutates refs and calls scheduleDraw()
    // only. An earlier build counted "renders after any move", which kept
    // climbing forever; this counter is reset per drag and measures the thing
    // the number is supposed to mean.
    const PERF = { drawMs: 0, drawMax: 0, drawn: 0, hostMs: 0, hostMethod: '', calls: 0, renders: 0, moves: 0, dragRenders: 0 }

    const liveRef = { current: null } // { kind:'node', id, x, y } during a drag
    const hoverRef = { current: null } // node id under the pointer
    const graphRef = { current: null }
    const paletteRef = { current: null }
    const canvasRef = { current: null }

    // -- timers -----------------------------------------------------------------
    function timerService() {
      const t = ctx.get('timer')
      return t !== undefined && typeof t.timeout === 'function' ? t : null
    }
    function later(ms, fn) {
      const t = timerService()
      if (t === null) return
      t.timeout(ms).then(function () { if (!stopped && !disposed) fn() })
    }

    // -- persistence ------------------------------------------------------------
    function persist() {
      const s = store.get()
      const positions = {}
      for (const k in manual) positions[k] = { x: manual[k].x, y: manual[k].y }
      saveCache({
        version: 1,
        positions: positions,
        view: viewRef.current,
        selected: s.selected.slice(0, 40),
        active: s.activeId,
        filters: s.filters,
        savedAt: Date.now(),
      })
    }
    function persistSoon() {
      if (persistTimer !== null) return
      const t = timerService()
      if (t === null) { persist(); return }
      persistTimer = t.timeout(800).then(function () {
        persistTimer = null
        if (!stopped && !disposed) persist()
      })
    }
    if (typeof store.subscribe === 'function') store.subscribe(persistSoon)

    // -- host RPC ---------------------------------------------------------------
    async function hostCall(method, args, timeoutMs) {
      const t0 = Date.now()
      const call = Promise.resolve()
        .then(function () { return host.call(method, args) })
        .then(function (r) {
          return r === undefined || r === null ? { ok: false, error: 'empty response' } : r
        }, function (e) {
          return { ok: false, error: String((e && e.message) || e) }
        })
      const finish = function (r) {
        const ms = Date.now() - t0
        PERF.calls += 1
        if (ms >= PERF.hostMs) { PERF.hostMs = ms; PERF.hostMethod = method }
        return r
      }
      if (!timeoutMs || timeoutMs <= 0) return call.then(finish)
      const t = timerService()
      if (t === null) return call.then(finish)
      const deadline = t.timeout(timeoutMs).then(function () {
        return { ok: false, error: 'Host 未在 ' + String(timeoutMs) + 'ms 内响应', timeout: true }
      })
      return Promise.race([call, deadline]).then(finish)
    }

    // -- scan loop --------------------------------------------------------------
    function signature(items) {
      const parts = []
      for (let i = 0; i < items.length; i++) {
        const s = items[i]
        parts.push(s.id + '|' + String(s.parentId || '') + '|' + String(s.origin || '') + '|' + (s.live ? '1' : '0'))
      }
      parts.sort()
      return String(items.length) + '#' + parts.join(',')
    }

    async function fetchTitles(ids) {
      const now = Date.now()
      if (now - titlesAt < 4000) return
      const want = []
      const have = store.get().titles
      for (let i = 0; i < ids.length && want.length < 150; i++) {
        const id = ids[i]
        if (typeof have[id] === 'string' && have[id].length > 0) continue
        want.push(id)
      }
      if (want.length === 0) return
      titlesAt = now
      const r = await hostCall('sc-titles', { ids: want }, 20000)
      if (r.ok && r.titles) store.set({ titles: merge(store.get().titles, r.titles) })
    }

    async function scan(force) {
      const r = await hostCall('sc-sessions', force === true ? { force: true } : {}, 15000)
      if (!r.ok || !Array.isArray(r.items)) {
        scanDelay = Math.min(Math.round(scanDelay * 1.6), 15000)
        store.set({ error: r.error || '会话列表读取失败' })
        return
      }
      const sig = signature(r.items)
      const first = store.get().items.length === 0
      if (sig !== lastSig || first) {
        lastSig = sig
        scanDelay = 2500
        const note = r.truncated === true ? ('仅显示前 ' + String(r.items.length) + ' / ' + String(r.total) + ' 个会话') : null
        const alive = {}
        for (let i = 0; i < r.items.length; i++) alive[r.items[i].id] = true
        const selected = store.get().selected.filter(function (id) { return alive[id] === true })
        const active = store.get().activeId
        store.set({
          items: r.items,
          scanAt: r.scannedAt || Date.now(),
          error: null,
          note: note,
          selected: selected,
          activeId: active && alive[active] === true ? active : null,
        })
        const ids = []
        for (let i = 0; i < r.items.length; i++) ids.push(r.items[i].id)
        await fetchTitles(ids)
        return
      }
      // Unchanged shape: back the poll off and only refresh the heartbeat
      // occasionally, so an idle canvas does not re-render every few seconds.
      scanDelay = Math.min(Math.round(scanDelay * 1.6), 15000)
      heartbeat += 1
      if (heartbeat % 6 === 0) store.set({ scanAt: r.scannedAt || Date.now() })
    }

    function scheduleScan(ms) {
      if (stopped || disposed) return
      const t = timerService()
      if (t === null) return
      scanTimer = t.timeout(ms).then(function () {
        scanTimer = null
        if (stopped || disposed) return
        scan(false).then(function () { scheduleScan(scanDelay) }, function () { scheduleScan(scanDelay) })
      })
    }

    // -- transcript -------------------------------------------------------------
    let transTimer = null
    let transDelay = 1500
    async function pollTranscript() {
      const id = store.get().activeId
      if (id === null) { store.set({ transcript: null }); return }
      const r = await hostCall('sc-read', { sessionId: id }, 15000)
      if (store.get().activeId !== id) return
      if (r.ok) {
        const prev = store.get().transcript
        const same = prev && prev.id === id && Array.isArray(prev.messages) && prev.messages.length === r.messages.length &&
          (r.messages.length === 0 || prev.messages[prev.messages.length - 1].seq === r.messages[r.messages.length - 1].seq)
        transDelay = same ? Math.min(Math.round(transDelay * 1.5), 9000) : 1500
        if (same) return
        store.set({ transcript: { id: id, messages: r.messages, omitted: r.omitted || 0, windowed: r.windowed === true, cwd: r.cwd, error: null } })
      } else {
        transDelay = Math.min(Math.round(transDelay * 1.5), 9000)
        store.set({ transcript: { id: id, messages: [], omitted: 0, windowed: false, cwd: null, error: r.error || '读取失败' } })
      }
    }
    function scheduleTranscript(ms) {
      if (stopped || disposed) return
      const t = timerService()
      if (t === null) return
      transTimer = t.timeout(ms).then(function () {
        transTimer = null
        if (stopped || disposed) return
        pollTranscript().then(function () {
          if (store.get().activeId !== null) scheduleTranscript(transDelay)
        }, function () {
          if (store.get().activeId !== null) scheduleTranscript(transDelay)
        })
      })
    }

    // -- prompt / cancel / fork -------------------------------------------------
    function targetsForBroadcast() {
      const s = store.get()
      const ids = s.selected.length > 0 ? s.selected : (s.activeId !== null ? [s.activeId] : [])
      const items = {}
      for (let i = 0; i < s.items.length; i++) items[s.items[i].id] = s.items[i]
      const out = []
      for (let i = 0; i < ids.length; i++) {
        const it = items[ids[i]]
        if (it === undefined) continue
        if (it.origin === 'subagent') continue
        out.push(it.id)
      }
      return out
    }

    async function sendPrompt(text, mode) {
      const body = typeof text === 'string' && text.trim().length > 0 ? text : store.get().composer
      if (body.trim().length === 0) { store.set({ error: '内容为空' }); return }
      const targets = targetsForBroadcast()
      if (targets.length === 0) { store.set({ error: '没有可指挥的普通会话（subagent 节点只读）' }); return }
      store.set({ busy: true, error: null, results: null })
      const results = []
      for (let i = 0; i < targets.length; i++) {
        const id = targets[i]
        const r = await hostCall('sc-prompt', { sessionId: id, text: body, mode: mode === 'steer' ? 'steer' : 'queue' }, 30000)
        results.push({ id: id, ok: r.ok === true, error: r.ok === true ? null : (r.error || '失败') })
      }
      const failed = results.filter(function (x) { return !x.ok }).length
      store.set({ busy: false, results: results, composer: failed === 0 ? '' : store.get().composer, error: failed === 0 ? null : (String(failed) + ' / ' + String(results.length) + ' 个会话投递失败') })
      pollTranscript().then(function () {}, function () {})
    }

    async function cancelActive() {
      const id = store.get().activeId
      if (id === null) return
      store.set({ busy: true, error: null })
      const r = await hostCall('sc-cancel', { sessionId: id }, 15000)
      store.set({ busy: false, error: r.ok === true ? null : (r.error || '取消失败'), results: [{ id: id, ok: r.ok === true, error: r.ok === true ? null : (r.error || '取消失败') }] })
    }

    async function forkActive() {
      const id = store.get().activeId
      if (id === null) return
      store.set({ busy: true, error: null })
      const r = await hostCall('sc-fork', { sessionId: id }, 30000)
      store.set({ busy: false, error: r.ok === true ? null : (r.error || 'fork 失败'), results: r.ok === true ? [{ id: id, ok: true, error: null }] : null })
      if (r.ok === true && typeof r.sessionId === 'string') await scan(true)
    }

    function openInSidebar(id) {
      const svc = ctx.get('sessions')
      if (svc === undefined || typeof svc.open !== 'function') { store.set({ error: 'sessions 服务不可用' }); return }
      try {
        svc.open(id)
      } catch (e) {
        store.set({ error: String((e && e.message) || e) })
      }
    }

    // -- selection --------------------------------------------------------------
    function select(id, additive) {
      const s = store.get()
      if (!additive) {
        store.set({ selected: [id], activeId: id, transcript: null })
        transDelay = 1500
        scheduleTranscript(300)
        return
      }
      const has = s.selected.indexOf(id) >= 0
      const selected = has ? s.selected.filter(function (x) { return x !== id }) : s.selected.concat([id])
      store.set({ selected: selected, activeId: has ? s.activeId : id, transcript: has ? s.transcript : null })
      if (!has) {
        transDelay = 1500
        scheduleTranscript(300)
      }
    }

    function setActive(id) {
      store.set({ activeId: id, transcript: null })
      if (id !== null) { transDelay = 1500; scheduleTranscript(300) }
    }

    function nodeAt(gx, gy, nodes) {
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i]
        if (gx >= n.x && gx <= n.x + NODE_W && gy >= n.y && gy <= n.y + NODE_H) return n
      }
      return null
    }

    // -- drawing ----------------------------------------------------------------
    const drawPending = { current: false }
    function scheduleDraw() {
      if (drawPending.current) return
      drawPending.current = true
      const run = function () {
        drawPending.current = false
        if (!disposed) drawGraph()
      }
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(run)
      else later(16, run)
    }

    function readPalette(el) {
      try {
        if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function' || !el) return FALLBACK
        const cs = window.getComputedStyle(el)
        const get = function (name, dflt) {
          const v = cs.getPropertyValue(name)
          const t = typeof v === 'string' ? v.trim() : ''
          return t.length > 0 ? t : dflt
        }
        return {
          label: get('--dsw-alias-label-primary', FALLBACK.label),
          dim: get('--dsw-alias-label-secondary', FALLBACK.dim),
          accent: get('--dsw-alias-brand-primary', FALLBACK.accent),
          ok: get('--dsw-alias-state-success-primary', FALLBACK.ok),
          warn: FALLBACK.warn,
          border: get('--dsw-alias-border-l2', FALLBACK.border),
          line: get('--dsw-alias-border-l2', FALLBACK.line),
          nodeBg: FALLBACK.nodeBg,
          subBg: FALLBACK.subBg,
          white: FALLBACK.white,
          fork: FALLBACK.fork,
          sub: FALLBACK.sub,
          bad: FALLBACK.bad,
        }
      } catch (e) {
        return FALLBACK
      }
    }

    function drawGraph() {
      const t0 = Date.now()
      const el = canvasRef.current
      if (!el || typeof el.getContext !== 'function') return
      let g = null
      try { g = el.getContext('2d') } catch (e) { return }
      if (!g) return
      if (paletteRef.current === null) paletteRef.current = readPalette(el)
      const pal = paletteRef.current
      const dpr = typeof window !== 'undefined' && window.devicePixelRatio ? Math.min(window.devicePixelRatio, 2) : 1
      const w = el.clientWidth || 800
      const hh = el.clientHeight || 600
      const pxW = Math.max(1, Math.round(w * dpr))
      const pxH = Math.max(1, Math.round(hh * dpr))
      if (el.width !== pxW || el.height !== pxH) { el.width = pxW; el.height = pxH }
      const v = viewRef.current
      g.setTransform(1, 0, 0, 1, 0, 0)
      g.clearRect(0, 0, el.width, el.height)
      g.setTransform(dpr * v.z, 0, 0, dpr * v.z, dpr * v.x, dpr * v.y)
      const view = { x0: -v.x / v.z, y0: -v.y / v.z, x1: (-v.x + w) / v.z, y1: (-v.y + hh) / v.z }
      const vis = function (x, y, ww, hhh) {
        return !(x + ww < view.x0 || x > view.x1 || y + hhh < view.y0 || y > view.y1)
      }

      const gr = graphRef.current
      const nodes = gr === null ? [] : gr.nodes
      const edges = gr === null ? [] : gr.edges
      const selected = store.get().selected
      const activeId = store.get().activeId
      const drag = liveRef.current

      function posOf(n) {
        if (drag !== null && drag.kind === 'node' && drag.id === n.id) return { x: drag.x, y: drag.y }
        return { x: n.x, y: n.y }
      }

      let drawn = 0
      // edges first, so nodes sit on top
      for (let i = 0; i < edges.length; i++) {
        const e = edges[i]
        const from = gr.nodeById[e.from]
        const to = gr.nodeById[e.to]
        if (from === undefined || to === undefined) continue
        const a = posOf(from)
        const b = posOf(to)
        const x1 = a.x + NODE_W
        const y1 = a.y + NODE_H / 2
        const x2 = b.x
        const y2 = b.y + NODE_H / 2
        if (!vis(Math.min(x1, x2) - 4, Math.min(y1, y2) - 8, Math.abs(x2 - x1) + 8, Math.abs(y2 - y1) + 16)) continue
        const hot = hoverRef.current === e.from || hoverRef.current === e.to || selected.indexOf(e.from) >= 0 || selected.indexOf(e.to) >= 0
        g.setLineDash(e.kind === 'sub' ? [5, 5] : [])
        g.lineWidth = hot ? 2 : 1.4
        g.strokeStyle = e.kind === 'sub' ? pal.sub : pal.fork
        g.globalAlpha = hot ? 0.95 : 0.55
        g.beginPath()
        g.moveTo(x1, y1)
        const mx = (x1 + x2) / 2
        g.bezierCurveTo(mx, y1, mx, y2, x2, y2)
        g.stroke()
        g.globalAlpha = 1
        // arrow head
        g.setLineDash([])
        g.beginPath()
        g.moveTo(x2, y2)
        g.lineTo(x2 - 7, y2 - 4)
        g.lineTo(x2 - 7, y2 + 4)
        g.closePath()
        g.fillStyle = e.kind === 'sub' ? pal.sub : pal.fork
        g.globalAlpha = hot ? 0.95 : 0.55
        g.fill()
        g.globalAlpha = 1
      }
      g.setLineDash([])

      const hoverId = hoverRef.current
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i]
        const p = posOf(n)
        if (!vis(p.x, p.y, NODE_W, NODE_H)) continue
        drawn += 1
        const isSel = selected.indexOf(n.id) >= 0
        const isAct = activeId === n.id
        roundRect(g, p.x, p.y, NODE_W, NODE_H, 10)
        g.fillStyle = n.kind === 'sub' ? pal.subBg : pal.nodeBg
        g.fill()
        g.lineWidth = isSel || isAct ? 2 : 1
        g.strokeStyle = isSel || isAct ? pal.accent : (hoverId === n.id ? pal.label : pal.border)
        if (n.kind === 'sub') g.setLineDash([4, 4])
        g.stroke()
        g.setLineDash([])
        // left kind bar
        g.fillStyle = n.kind === 'sub' ? pal.sub : (n.kind === 'fork' ? pal.fork : pal.accent)
        roundRect(g, p.x, p.y, 4, NODE_H, 2)
        g.fill()
        // title
        g.font = '12px ' + FONT_STACK
        g.fillStyle = n.hasTitle ? pal.label : pal.dim
        g.textAlign = 'left'
        g.textBaseline = 'middle'
        g.fillText(clipText(g, n.title, NODE_W - 34), p.x + 12, p.y + 17)
        // meta line
        g.font = '10px ' + FONT_STACK
        g.fillStyle = pal.dim
        const meta = (n.kind === 'sub' ? 'sub' : (n.kind === 'fork' ? 'fork' : 'root')) +
          (n.childCount > 0 ? '  ·  ' + String(n.childCount) + ' 子' : '') +
          (n.cwd ? '  ·  ' + basename(n.cwd) : '')
        g.fillText(clipText(g, meta, NODE_W - 58), p.x + 12, p.y + 37)
        // id line
        g.font = '9.5px ' + FONT_FAMILY_MONO
        g.fillStyle = pal.dim
        g.fillText(clipText(g, shortId(n.id), NODE_W - 58), p.x + 12, p.y + 50)
        // live dot
        g.beginPath()
        g.arc(p.x + NODE_W - 12, p.y + 12, 4, 0, Math.PI * 2)
        g.fillStyle = n.live ? pal.ok : pal.border
        g.fill()
      }

      if (hoverId !== null && gr !== null && gr.nodeById[hoverId] !== undefined && drag === null) {
        const n = gr.nodeById[hoverId]
        const p = posOf(n)
        drawHover(g, pal, n, p)
      }

      const ms = Date.now() - t0
      PERF.drawMs = ms
      if (ms > PERF.drawMax) PERF.drawMax = ms
      PERF.drawn = drawn
    }

    function drawHover(g, pal, n, p) {
      const lines = [
        n.title,
        'id      ' + shortId(n.id),
        'kind    ' + n.kind + (n.origin ? ' (' + n.origin + ')' : ''),
        'state   ' + (n.live ? 'live' : 'inactive'),
        'cwd     ' + (n.cwd || '-'),
        'created ' + (fmtTime(n.createdAt) || '-'),
        'children ' + String(n.childCount),
      ]
      const boxW = 340
      const boxH = 18 + lines.length * 15
      let bx = p.x + NODE_W + 12
      let by = p.y
      const v = viewRef.current
      const el = canvasRef.current
      const w = el ? (el.clientWidth || 800) : 800
      const hh = el ? (el.clientHeight || 600) : 600
      const gx = (w - v.x) / v.z
      const gy = (hh - v.y) / v.z
      if (bx + boxW > gx) bx = p.x - boxW - 12
      if (by + boxH > gy) by = Math.max(0, gy - boxH - 4)
      roundRect(g, bx, by, boxW, boxH, 10)
      g.fillStyle = pal.nodeBg
      g.fill()
      g.lineWidth = 1
      g.strokeStyle = pal.border
      g.stroke()
      g.textAlign = 'left'
      g.textBaseline = 'middle'
      for (let i = 0; i < lines.length; i++) {
        g.font = (i === 0 ? '12px ' : '10.5px ') + (i === 0 ? FONT_STACK : FONT_FAMILY_MONO)
        g.fillStyle = i === 0 ? pal.label : pal.dim
        g.fillText(clipText(g, lines[i], boxW - 20), bx + 10, by + 14 + i * 15)
      }
    }

    function fitToContent() {
      const gr = graphRef.current
      const el = canvasRef.current
      if (gr === null || gr.nodes.length === 0 || !el) {
        viewRef.current = { x: 36, y: 30, z: 1 }
        store.set({ zoom: 1 })
        scheduleDraw()
        return
      }
      const w = el.clientWidth || 800
      const hh = el.clientHeight || 600
      const pad = 48
      const zx = (w - pad * 2) / Math.max(1, gr.maxX)
      const zy = (hh - pad * 2) / Math.max(1, gr.maxY)
      const z = clamp(Math.min(zx, zy), 0.08, 1.6)
      viewRef.current = { x: pad, y: pad, z: z }
      store.set({ zoom: z })
      scheduleDraw()
    }

    function zoomBy(factor, cx, cy) {
      const v = viewRef.current
      const next = clamp(v.z * factor, 0.08, 2.5)
      if (next === v.z) return
      const el = canvasRef.current
      const w = el ? (el.clientWidth || 800) : 800
      const hh = el ? (el.clientHeight || 600) : 600
      const px = typeof cx === 'number' ? cx : w / 2
      const py = typeof cy === 'number' ? cy : hh / 2
      const gx = (px - v.x) / v.z
      const gy = (py - v.y) / v.z
      viewRef.current = { x: px - gx * next, y: py - gy * next, z: next }
      store.set({ zoom: next })
      scheduleDraw()
    }

    function resetCanvas() {
      for (const k in manual) delete manual[k]
      clearCache()
      viewRef.current = { x: 36, y: 30, z: 1 }
      store.set({ zoom: 1, selected: [], activeId: null, transcript: null, error: null, note: null, manualVersion: store.get().manualVersion + 1 })
      scheduleDraw()
      scan(true).then(function () {}, function () {})
    }

    // -- CanvasApp --------------------------------------------------------------
    function useStore() {
      const pair = React.useState(store.get())
      const snap = pair[0]
      const setSnap = pair[1]
      React.useEffect(function () {
        setSnap(store.get())
        return store.subscribe(function () { setSnap(store.get()) })
      }, [])
      return snap
    }

    function CanvasApp() {
      const st = useStore()
      PERF.renders += 1
      if (dragActive) PERF.dragRenders += 1

      const graph = React.useMemo(function () {
        return buildGraph(st.items, st.titles, st.filters, manual)
      }, [st.items, st.titles, st.filters.q, st.filters.ws, st.filters.showSub, st.filters.onlyChildren, st.manualVersion])
      graphRef.current = graph

      React.useEffect(function () {
        if (!fitted && graph.nodes.length > 0) {
          fitted = true
          fitToContent()
        } else {
          scheduleDraw()
        }
      }, [graph, st.selected, st.activeId, st.zoom])

      React.useEffect(function () {
        const el = canvasRef.current
        if (!el) return
        const onResize = function () { paletteRef.current = null; scheduleDraw() }
        if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') window.addEventListener('resize', onResize)
        return function () {
          if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') window.removeEventListener('resize', onResize)
        }
      }, [])

      React.useEffect(function () {
        stopped = false
        hostCall('sc-info', {}, 8000).then(function (r) {
          if (r && r.ok === true) store.set({ info: r })
          else store.set({ info: { ok: false, error: (r && r.error) || 'sc-info failed' } })
        }, function () {})
        scan(true).then(function () { scheduleScan(scanDelay) }, function () { scheduleScan(scanDelay) })
        return function () {
          stopped = true
          if (transTimer !== null) transTimer = null
        }
      }, [])

      const workspaces = React.useMemo(function () {
        const seen = {}
        const out = []
        for (let i = 0; i < st.items.length; i++) {
          const cwd = st.items[i].cwd
          if (typeof cwd !== 'string' || cwd.length === 0) continue
          if (seen[cwd] === true) continue
          seen[cwd] = true
          out.push(cwd)
        }
        out.sort()
        return out
      }, [st.items])

      function onPointerDown(e) {
        const el = canvasRef.current
        if (!el) return
        // Capture is a convenience, not a correctness requirement: if the
        // browser refuses it the drag still works from the pointermove events
        // that reach the canvas. It must never break the click.
        try { if (typeof el.setPointerCapture === 'function') el.setPointerCapture(e.pointerId) } catch (err) {}
        const rect = el.getBoundingClientRect()
        const px = e.clientX - rect.left
        const py = e.clientY - rect.top
        const v = viewRef.current
        const gx = (px - v.x) / v.z
        const gy = (py - v.y) / v.z
        const n = nodeAt(gx, gy, graphRef.current ? graphRef.current.nodes : [])
        if (n !== null) {
          liveRef.current = { kind: 'node', id: n.id, x: n.x, y: n.y, px: px, py: py, moved: false }
        } else {
          liveRef.current = { kind: 'pan', px: px, py: py, ox: v.x, oy: v.y, moved: false }
          const el2 = canvasRef.current
          if (el2) el2.setAttribute('data-panning', '1')
        }
      }

      function onPointerMove(e) {
        const el = canvasRef.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        const px = e.clientX - rect.left
        const py = e.clientY - rect.top
        const drag = liveRef.current
        if (drag === null) {
          const v = viewRef.current
          const gx = (px - v.x) / v.z
          const gy = (py - v.y) / v.z
          const n = nodeAt(gx, gy, graphRef.current ? graphRef.current.nodes : [])
          const id = n === null ? null : n.id
          if (id !== hoverRef.current) { hoverRef.current = id; scheduleDraw() }
          return
        }
        dragActive = true
        PERF.moves += 1
        if (drag.kind === 'pan') {
          const v = viewRef.current
          viewRef.current = { x: drag.ox + (px - drag.px), y: drag.oy + (py - drag.py), z: v.z }
          drag.moved = true
          scheduleDraw()
          return
        }
        const v = viewRef.current
        const nx = drag.x + (px - drag.px) / v.z
        const ny = drag.y + (py - drag.py) / v.z
        liveRef.current = { kind: 'node', id: drag.id, x: nx, y: ny, px: drag.px, py: drag.py, moved: true }
        scheduleDraw()
      }

      function onPointerUp(e) {
        const el = canvasRef.current
        if (el) {
          try { el.setAttribute('data-panning', '0') } catch (err) {}
          // Released inside try/catch: a throwing releasePointerCapture must
          // not swallow the click that follows.
          try { if (typeof el.releasePointerCapture === 'function') el.releasePointerCapture(e.pointerId) } catch (err) {}
        }
        const drag = liveRef.current
        liveRef.current = null
        dragActive = false
        if (drag === null) return
        if (drag.kind === 'pan') {
          if (drag.moved) persistSoon()
          scheduleDraw()
          return
        }
        if (drag.moved) {
          manual[drag.id] = { x: drag.x, y: drag.y }
          store.set({ manualVersion: store.get().manualVersion + 1 })
        } else {
          select(drag.id, e.ctrlKey === true || e.metaKey === true || store.get().multi === true)
        }
        scheduleDraw()
      }

      function onWheel(e) {
        e.preventDefault && e.preventDefault()
        const el = canvasRef.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        zoomBy(e.deltaY < 0 ? 1.1 : 0.9, e.clientX - rect.left, e.clientY - rect.top)
      }

      function onDoubleClick(e) {
        const el = canvasRef.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        const v = viewRef.current
        const gx = (e.clientX - rect.left - v.x) / v.z
        const gy = (e.clientY - rect.top - v.y) / v.z
        const n = nodeAt(gx, gy, graphRef.current ? graphRef.current.nodes : [])
        if (n !== null) { setActive(n.id); select(n.id, false) }
      }

      const activeNode = st.activeId !== null && graph.nodeById[st.activeId] !== undefined ? graph.nodeById[st.activeId] : null
      const broadcastCount = targetsForBroadcast().length

      const bar = h('div', { className: 'sc-bar' },
        h('b', null, 'Session Canvas'),
        h('input', {
          className: 'sc-inp',
          placeholder: '搜索标题 / id / 目录',
          value: st.filters.q,
          onChange: function (e) { store.set({ filters: merge(st.filters, { q: e.target.value }) }) },
        }),
        h('select', {
          className: 'sc-sel',
          value: st.filters.ws,
          onChange: function (e) { store.set({ filters: merge(st.filters, { ws: e.target.value }) }) },
        },
          h('option', { value: '__all__' }, '全部目录'),
          workspaces.map(function (w) { return h('option', { key: w, value: w }, basename(w) || w) }),
        ),
        h('button', {
          className: st.filters.showSub ? 'sc-btn sc-on' : 'sc-btn',
          onClick: function () { store.set({ filters: merge(st.filters, { showSub: !st.filters.showSub }) }) },
        }, 'subagent'),
        h('button', {
          className: st.filters.onlyChildren ? 'sc-btn sc-on' : 'sc-btn',
          onClick: function () { store.set({ filters: merge(st.filters, { onlyChildren: !st.filters.onlyChildren }) }) },
        }, '仅有分叉'),
        h('button', {
          className: st.multi ? 'sc-btn sc-on' : 'sc-btn',
          title: '多选：单击即加入选择（触屏用；桌面可按住 Ctrl/Cmd）',
          onClick: function () { store.set({ multi: !st.multi }) },
        }, '多选'),
        h('span', { className: 'sc-spacer' }),
        h('button', { className: 'sc-btn', onClick: function () { scan(true).then(function () {}, function () {}) } }, '刷新'),
        h('button', { className: 'sc-btn', onClick: fitToContent }, '适应'),
        h('button', { className: 'sc-btn', onClick: function () { zoomBy(0.9) } }, '−'),
        h('button', { className: 'sc-btn', onClick: function () { zoomBy(1.25) } }, '+'),
        h('button', { className: 'sc-btn', onClick: resetCanvas }, '重置'),
        h('button', {
          className: st.perfOn ? 'sc-btn sc-on' : 'sc-btn',
          onClick: function () { store.set({ perfOn: !st.perfOn }) },
        }, '性能'),
      )

      const svc = st.info && st.info.services ? st.info.services : null
      const missing = svc === null ? '' : (function () {
        const m = []
        if (svc.sessionQuery !== true) m.push('sessionQuery')
        if (svc.sessionController !== true) m.push('sessionController')
        return m.length > 0 ? '  ·  缺少服务 ' + m.join('/') : ''
      })()

      const status = h('div', { className: 'sc-note', style: { position: 'absolute', top: '56px', left: '10px', zIndex: 28, maxWidth: '60%' } },
        '节点 ' + String(graph.nodes.length) + ' / 会话 ' + String(st.items.length) +
        (graph.hidden > 0 ? '（过滤掉 ' + String(graph.hidden) + '）' : '') +
        '  ·  已选 ' + String(st.selected.length) +
        '  ·  build ' + STAMP + (st.info && st.info.build ? '/' + String(st.info.build) : '') +
        (st.scanAt ? '  ·  ' + fmtTime(st.scanAt) : '') +
        (st.note ? '  ·  ' + st.note : '') +
        missing +
        (st.error ? '  ·  ' + st.error : ''),
      )

      const hud = st.perfOn ? h('div', { className: 'sc-hud' },
        'draw   ' + String(PERF.drawMs) + ' ms (峰值 ' + String(PERF.drawMax) + ')\n' +
        'nodes  ' + String(PERF.drawn) + '\n' +
        'host   ' + String(PERF.hostMs) + ' ms  ' + PERF.hostMethod + '\n' +
        'calls  ' + String(PERF.calls) + '\n' +
        'renders ' + String(PERF.renders) + '  拖动事件 ' + String(PERF.moves) + '  拖动期渲染 ' + String(PERF.dragRenders) + '（目标 0）\n' +
        'zoom   ' + String(Math.round(st.zoom * 100)) + '%\n' +
        'build  ' + STAMP,
      ) : null

      const dock = activeNode !== null ? h(TranscriptDock, { node: activeNode, broadcastCount: broadcastCount }) : null

      return h('div', { className: 'sc-root' },
        bar,
        status,
        h('canvas', {
          ref: canvasRef,
          className: 'sc-graph',
          'data-panning': '0',
          onPointerDown: onPointerDown,
          onPointerMove: onPointerMove,
          onPointerUp: onPointerUp,
          onPointerCancel: onPointerUp,
          onPointerLeave: function () { if (liveRef.current === null && hoverRef.current !== null) { hoverRef.current = null; scheduleDraw() } },
          onWheel: onWheel,
          onDoubleClick: onDoubleClick,
        }),
        dock,
        hud,
      )
    }

    // -- TranscriptDock ---------------------------------------------------------
    function TranscriptDock(props) {
      const node = props.node
      const st = useStore()
      const logRef = React.useRef(null)
      const stickRef = React.useRef(true)

      const trans = st.transcript && st.transcript.id === node.id ? st.transcript : null
      const messages = trans && Array.isArray(trans.messages) ? trans.messages : []

      React.useEffect(function () {
        const el = logRef.current
        if (!el || !stickRef.current) return
        el.scrollTop = el.scrollHeight
      }, [messages.length, node.id])

      function onScroll(e) {
        const el = e.target
        if (!el) return
        stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
      }

      const isSub = node.origin === 'subagent'
      const selected = st.selected
      const broadcast = isSub ? 0 : (selected.length > 1 ? selected.filter(function (id) {
        const n = graphRef.current && graphRef.current.nodeById[id]
        return n !== undefined && n.origin !== 'subagent'
      }).length : 1)

      const metaRows = []
      metaRows.push(h('div', { className: 'sc-mrow', key: 'kind' },
        h('span', { className: 'sc-mk' }, '类型'),
        h('span', { className: 'sc-mv' }, node.kind + (isSub ? ' · 只读（subagent 通道未接入）' : '')),
      ))
      metaRows.push(h('div', { className: 'sc-mrow', key: 'id' },
        h('span', { className: 'sc-mk' }, '会话'),
        h('span', { className: 'sc-mv sc-mono' }, node.id),
      ))
      if (node.cwd) metaRows.push(h('div', { className: 'sc-mrow', key: 'cwd' },
        h('span', { className: 'sc-mk' }, '目录'),
        h('span', { className: 'sc-mv' }, node.cwd),
      ))
      if (node.parentId) metaRows.push(h('div', { className: 'sc-mrow', key: 'parent' },
        h('span', { className: 'sc-mk' }, '父会话'),
        h('button', {
          className: 'sc-btn',
          onClick: function () { if (graphRef.current && graphRef.current.nodeById[node.parentId]) { select(node.parentId, false); setActive(node.parentId) } },
        }, shortId(node.parentId)),
      ))
      if (node.children.length > 0) metaRows.push(h('div', { className: 'sc-mrow', key: 'kids' },
        h('span', { className: 'sc-mk' }, '子会话'),
        h('span', { className: 'sc-mv' }, String(node.children.length) + ' 个'),
      ))

      const results = st.results !== null ? h('div', { className: 'sc-res' }, st.results.map(function (r, i) {
        return h('div', { key: String(i), className: r.ok ? 'sc-ok' : 'sc-bad' }, (r.ok ? '✓ ' : '✗ ') + shortId(r.id) + (r.error ? ' — ' + r.error : ''))
      })) : null

      const composer = isSub ? h('div', { className: 'sc-compose' },
        h('div', { className: 'sc-note' }, 'subagent 节点只展示拓扑与 transcript；要从画布指挥它需要 subagent 控制通道（本轮未接入）。'),
      ) : h('div', { className: 'sc-compose' },
        broadcast > 1 ? h('div', { className: 'sc-chip' }, '广播到 ' + String(broadcast) + ' 个会话') : null,
        h('textarea', {
          className: 'sc-ta',
          placeholder: '给该会话发送一条消息（Enter 发送，Shift+Enter 换行）',
          value: st.composer,
          onChange: function (e) { store.set({ composer: e.target.value }) },
          onKeyDown: function (e) {
            if (e.key === 'Enter' && e.shiftKey !== true) {
              e.preventDefault()
              sendPrompt(null, st.delivery)
            }
          },
        }),
        h('div', { className: 'sc-row' },
          h('button', {
            className: st.delivery === 'queue' ? 'sc-btn sc-on' : 'sc-btn',
            onClick: function () { store.set({ delivery: 'queue' }) },
          }, 'queue'),
          h('button', {
            className: st.delivery === 'steer' ? 'sc-btn sc-on' : 'sc-btn',
            onClick: function () { store.set({ delivery: 'steer' }) },
          }, 'steer'),
          h('span', { className: 'sc-spacer' }),
          h('button', { className: 'sc-btn', disabled: st.busy, onClick: function () { sendPrompt(null, st.delivery) } }, st.busy ? '发送中…' : '发送'),
        ),
        h('div', { className: 'sc-row' },
          h('button', { className: 'sc-btn', disabled: st.busy || !node.live, onClick: cancelActive }, '停止当前轮'),
          h('button', { className: 'sc-btn', disabled: st.busy, onClick: forkActive }, 'Fork'),
          h('button', { className: 'sc-btn', onClick: function () { openInSidebar(node.id) } }, '在侧栏打开'),
          h('span', { className: 'sc-spacer' }),
          h('button', { className: 'sc-btn', onClick: function () { setActive(null) } }, '关闭'),
        ),
        results,
        st.error ? h('div', { className: 'sc-bad' }, st.error) : null,
      )

      return h('div', { className: 'sc-right' },
        h('div', { className: 'sc-dock-head' },
          h('span', { className: 'sc-t' }, node.title),
          h('span', { className: 'sc-chip' }, node.kind),
          h('span', { className: 'sc-chip' }, node.live ? 'live' : 'inactive'),
        ),
        h('div', { className: 'sc-meta' }, metaRows),
        h('div', { className: 'sc-log', ref: logRef, onScroll: onScroll },
          trans === null ? h('div', { className: 'sc-note' }, '读取中…')
            : (trans.error ? h('div', { className: 'sc-bad' }, trans.error)
              : (messages.length === 0 ? h('div', { className: 'sc-note' }, '（还没有消息）')
                : messages.map(function (m, i) {
                  return h('div', { key: String(m.seq) + ':' + String(i), className: 'sc-msg', 'data-role': m.role }, m.text)
                }))),
          trans !== null && (trans.omitted > 0 || trans.windowed === true)
            ? h('div', { className: 'sc-note' },
              '（更早的 ' + String(trans.omitted) + ' 条已省略' + (trans.windowed === true ? '；日志更长，仅扫描了尾部窗口' : '') + '）')
            : null,
        ),
        composer,
      )
    }

    // -- sidebar icon + tool card ----------------------------------------------
    function CanvasIcon(props) {
      const size = (props && props.size) || 18
      const color = props && props.active ? 'var(--dsw-alias-brand-primary,#4d6bfe)' : 'currentColor'
      return h('svg', { width: size, height: size, viewBox: '0 0 20 20', fill: 'none', stroke: color, strokeWidth: 1.6, strokeLinecap: 'round' },
        h('circle', { cx: 5, cy: 10, r: 2.4 }),
        h('circle', { cx: 15, cy: 5, r: 2.4 }),
        h('circle', { cx: 15, cy: 15, r: 2.4 }),
        h('path', { d: 'M7.2 9 L12.8 5.8' }),
        h('path', { d: 'M7.2 11 L12.8 14.2' }),
      )
    }

    function RunCard() {
      const st = useStore()
      const graph = graphRef.current
      const svc = st.info && st.info.services ? st.info.services : null
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' } },
        h('div', { style: { fontWeight: 600 } }, 'Session Canvas · 会话拓扑'),
        h('div', { className: 'sc-note' },
          'build client ' + STAMP + ' · host ' + String(svc && st.info && st.info.build ? st.info.build : '未知') +
          ' · 节点 ' + String(graph ? graph.nodes.length : 0) +
          ' · 会话 ' + String(st.items.length) + ' · 已选 ' + String(st.selected.length)),
        h('div', { className: 'sc-note' },
          svc === null ? '服务状态未知'
            : ('sessionQuery ' + (svc.sessionQuery ? '✓' : '✗') + ' · sessionController ' + (svc.sessionController ? '✓' : '✗'))),
        h('button', {
          className: 'sc-btn sc-on',
          onClick: function () {
            try {
              const layout = ctx.get('layout')
              if (layout !== undefined && typeof layout.selectPanel === 'function') layout.selectPanel(PANEL_ID)
            } catch (e) {}
          },
        }, '打开画布'),
      )
    }

    // -- registration -----------------------------------------------------------
    ctx.effect(function () { return styles.insert(CSS.join('\n')) })
    slots.inject('main', function () {
      return slots.register({ name: 'main', key: PANEL_ID }, function () { return h(CanvasApp, null) })
    })
    slots.inject('sidebar.panellist', function () {
      return slots.register({ name: 'sidebar.panellist', id: PANEL_ID, order: 4, label: '会话拓扑' }, function (props) {
        return h(CanvasIcon, { size: (props && props.size) || 18, active: !!(props && props.active) })
      })
    })
    slots.inject('tool.view.cordis', function () {
      return slots.register({ name: 'tool.view.cordis', key: 'self' }, function () { return h(RunCard, null) })
    })

    console.log('[session-canvas] client apply ' + STAMP + ': panel "' + PANEL_ID + '" registered')
  },
}
