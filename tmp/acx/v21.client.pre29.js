const h = React.createElement
const PANEL_ID = 'agent-canvas'
const WS_ID = '__workspace__'
const AGENT_SIZE = 56
const FILE_W = 200
const FILE_H = 44
const ROW_PER_COL = 6
const CONTENT_W = 4200
const CONTENT_H = 3200
const FONT_STACK = 'ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif'
let lastDrawCount = 0
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
}
const clipCache = {}
let clipCacheSize = 0
const COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']
const CSS = [
  '.acx-root{position:relative;flex:1 1 auto;height:100%;min-height:0;width:100%;overflow:hidden;background:var(--dsw-alias-bg-base,transparent);color:var(--dsw-alias-label-primary,inherit);font-size:13px;line-height:1.45}',
  '.acx-canvas{position:absolute;inset:0;z-index:0;pointer-events:none;background-color:var(--dsw-alias-bg-base,transparent);background-image:radial-gradient(var(--dsw-alias-border-l1,rgba(127,127,127,.35)) 1px,transparent 1px);background-size:22px 22px}',
  '.acx-graph{position:absolute;inset:0;z-index:1;display:block;width:100%;height:100%;touch-action:none;cursor:grab}',
  '.acx-graph[data-panning=1]{cursor:grabbing}',
  '.acx-layer{position:absolute;inset:0;z-index:2;pointer-events:none}',
  '.acx-edges{position:absolute;left:0;top:0;pointer-events:none;overflow:visible}',
  '.acx-bar{position:absolute;top:8px;left:8px;right:8px;z-index:30;display:flex;align-items:center;gap:6px;padding:6px;border:1px solid var(--dsw-alias-border-l3,rgba(127,127,127,.35));border-radius:12px;background:var(--dsw-alias-button-floating-fill,var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-layer-2,rgba(20,20,24,.86))));flex-wrap:wrap;row-gap:6px;max-height:40%;overflow-x:hidden;overflow-y:auto}',
  '.acx-bar::-webkit-scrollbar{width:6px;height:6px}',
  '.acx-bar b{font-size:12.5px;font-weight:600;white-space:nowrap;flex:none}',
  '.acx-btn{display:inline-flex;align-items:center;gap:5px;flex:none;border:1px solid var(--dsw-alias-border-l3,rgba(127,127,127,.4));background:var(--dsw-alias-bg-layer-1,transparent);color:var(--dsw-alias-label-primary,inherit);border-radius:8px;padding:4px 10px;font:inherit;font-size:12px;line-height:1.5;cursor:pointer;white-space:nowrap}',
  '.acx-btn:hover:not([disabled]){background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-3,transparent))}',
  '.acx-btn[disabled]{opacity:.45;cursor:default}',
  '.acx-primary{background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary,#4d6bfe));border-color:transparent;color:var(--dsw-alias-label-primary-foreground,#fff)}',
  '.acx-primary:hover:not([disabled]){background:var(--dsw-alias-button-primary-hover,var(--dsw-alias-brand-primary,#4d6bfe));color:var(--dsw-alias-label-primary-foreground,#fff)}',
  '.acx-danger{color:var(--dsw-alias-state-error-primary,inherit);border-color:var(--dsw-alias-state-error-primary,currentColor)}',
  '.acx-danger:hover:not([disabled]){background:var(--dsw-alias-interactive-bg-hover-danger,transparent);color:var(--dsw-alias-state-error-primary,inherit)}',
  '.acx-spacer{flex:1 1 auto}',
  '.acx-mini{flex:none;border:1px solid transparent;background:transparent;color:var(--dsw-alias-label-secondary,inherit);cursor:pointer;font:inherit;font-size:11px;padding:1px 5px;border-radius:6px}',
  '.acx-mini:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-3,transparent));color:var(--dsw-alias-label-primary,inherit)}',
  '.acx-form{position:absolute;left:8px;right:8px;bottom:8px;z-index:18;max-height:62%;overflow:auto;border:1px solid var(--dsw-alias-border-l3,rgba(127,127,127,.35));border-radius:14px;background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-layer-2,transparent));box-shadow:0 12px 32px rgba(0,0,0,.28);padding:12px;display:flex;flex-direction:column;gap:9px}',
  '.acx-form-title{font-weight:600;font-size:13px}',
  // The right column holds the agent settings panel and the chat dock. It is a
  // transparent flex track: only its children take pointer events, so the empty
  // area under a short settings panel still lets the canvas be dragged.
  '.acx-right{position:absolute;top:96px;right:8px;bottom:8px;z-index:16;width:min(392px,48%);display:flex;flex-direction:column;gap:8px;min-height:0;pointer-events:none}',
  '.acx-right>*{pointer-events:auto}',
  '.acx-dock{flex:1 1 auto;display:flex;flex-direction:column;min-height:0;border:1px solid var(--dsw-alias-border-l3,rgba(127,127,127,.35));border-radius:14px;background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-layer-2,transparent));box-shadow:0 12px 32px rgba(0,0,0,.28);overflow:hidden}',
  '.acx-side{flex:0 1 auto;max-height:64%;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:8px;padding:12px;font-size:12px;border:1px solid var(--dsw-alias-border-l3,rgba(127,127,127,.35));border-radius:14px;background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-layer-2,transparent));box-shadow:0 12px 32px rgba(0,0,0,.28)}',
  '.acx-sheet{position:absolute;left:8px;right:8px;bottom:8px;z-index:20;max-height:58%;overflow:auto;border:1px solid var(--dsw-alias-border-l3,rgba(127,127,127,.35));border-radius:14px;background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-layer-2,transparent));box-shadow:0 12px 32px rgba(0,0,0,.28);padding:12px;font-size:12px;line-height:1.55}',
  '.acx-sheet-head{display:flex;align-items:center;gap:8px;margin-bottom:6px}',
  '.acx-sheet-head b{flex:1;font-size:13px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.acx-file{position:absolute;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.3));background:var(--dsw-alias-bg-layer-1,transparent);border-radius:9px;padding:6px 8px;display:flex;flex-direction:column;gap:2px;overflow:hidden;cursor:grab;user-select:none;touch-action:none}',
  '.acx-file[data-selected=1]{outline:2px solid var(--dsw-alias-brand-primary,#4d6bfe);outline-offset:1px}',
  '.acx-file[data-new=1]{border-color:var(--dsw-alias-state-success-primary,#2ea043)}',
  '.acx-file[data-dragging=1]{cursor:grabbing;z-index:4;box-shadow:0 10px 24px rgba(0,0,0,.22)}',
  '.acx-file[data-kind=dir] .acx-fname{font-weight:600}',
  '.acx-fname{font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
  '.acx-fmeta{font-size:10px;color:var(--dsw-alias-label-secondary,inherit);display:flex;align-items:center;gap:5px;min-width:0}',
  '.acx-agent{position:absolute;width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid var(--dsw-alias-border-l2,rgba(127,127,127,.3));background:var(--dsw-alias-bg-layer-1,transparent);cursor:grab;user-select:none;box-sizing:border-box;touch-action:none}',
  '.acx-agent>span{font-size:15px;font-weight:600}',
  '.acx-agent[data-selected=1]{box-shadow:0 0 0 3px var(--dsw-alias-brand-primary,rgba(77,107,254,.55))}',
  '.acx-agent[data-dragging=1]{cursor:grabbing;z-index:5;opacity:.92}',
  '.acx-agent-label{position:absolute;top:58px;left:-18px;width:92px;text-align:center;font-size:10.5px;color:var(--dsw-alias-label-secondary,inherit);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.acx-dot{position:absolute;right:0;top:0;width:11px;height:11px;border-radius:50%;border:2px solid var(--dsw-alias-bg-base,transparent)}',
  '.acx-badge{position:absolute;left:-4px;top:-4px;min-width:16px;height:16px;border-radius:8px;background:var(--dsw-alias-state-success-primary,#2ea043);color:var(--dsw-alias-label-primary-inverted,#fff);font-size:10px;display:flex;align-items:center;justify-content:center;padding:0 4px}',
  '.acx-hover{position:absolute;width:320px;box-sizing:border-box;background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-layer-2,transparent));border:1px solid var(--dsw-alias-border-l3,rgba(127,127,127,.35));border-radius:12px;padding:10px;font-size:11.5px;line-height:1.5;z-index:20;box-shadow:0 12px 32px rgba(0,0,0,.28);pointer-events:none}',
  '.acx-hsect{margin-top:6px;padding-top:6px;border-top:1px dashed var(--dsw-alias-border-l2,rgba(127,127,127,.3))}',
  '.acx-hlab{color:var(--dsw-alias-label-secondary,inherit);font-size:10px}',
  '.acx-mono{font-family:var(--dsw-font-mono,ui-monospace,Menlo,monospace);font-size:10px;word-break:break-all;color:var(--dsw-alias-label-secondary,inherit)}',
  '.acx-flist{display:flex;flex-direction:column;gap:1px;max-height:104px;overflow:hidden}',
  '.acx-frow{font-size:10.5px;display:flex;gap:4px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}',
  '.acx-dock-head{display:flex;align-items:center;gap:6px;padding:8px 10px;border-bottom:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.3));font-weight:600;font-size:12.5px;flex:none}',
  '.acx-chips{display:flex;flex-wrap:wrap;align-items:center;gap:5px;padding:7px 10px;border-bottom:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.3));flex:none}',
  '.acx-chip{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--dsw-alias-border-l3,rgba(127,127,127,.35));border-radius:999px;padding:1px 8px;font-size:11px;background:var(--dsw-alias-bg-layer-1,transparent)}',
  '.acx-log{flex:1 1 auto;min-height:0;overflow:auto;padding:10px;display:flex;flex-direction:column;gap:8px}',
  '.acx-msg{border-radius:9px;padding:6px 9px;font-size:12px;white-space:pre-wrap;word-break:break-word;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.3))}',
  '.acx-msg[data-role=user]{background:var(--dsw-alias-bg-layer-1,transparent);align-self:flex-end;max-width:92%}',
  '.acx-msg[data-role=assistant]{background:transparent;max-width:96%}',
  '.acx-msg[data-role=tool]{font-size:11px;color:var(--dsw-alias-label-secondary,inherit);border-style:dashed;max-width:96%}',
  '.acx-msg[data-live=1]{border-color:var(--dsw-alias-brand-primary,#4d6bfe)}',
  '.acx-compose{border-top:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.3));padding:9px;display:flex;flex-direction:column;gap:7px;flex:none}',
  '.acx-row{display:flex;align-items:center;gap:7px;flex-wrap:wrap}',
  '.acx-res{font-size:11px;display:flex;flex-direction:column;gap:3px;max-height:88px;overflow:auto}',
  '.acx-ok{color:var(--dsw-alias-state-success-primary,#2ea043)}',
  '.acx-err{color:var(--dsw-alias-state-error-primary,#d54941)}',
  '.acx-warn{color:var(--dsw-alias-state-warn-primary,inherit)}',
  '.acx-hint{font-size:11.5px;color:var(--dsw-alias-label-secondary,inherit);line-height:1.5}',
  '.acx-ta{width:100%;min-height:72px;box-sizing:border-box;resize:vertical;background:var(--dsw-alias-bg-layer-1,transparent);color:var(--dsw-alias-label-primary,inherit);border:1px solid var(--dsw-alias-border-l3,rgba(127,127,127,.35));border-radius:9px;padding:8px;font:inherit;font-size:12.5px}',
  '.acx-ta::placeholder,.acx-inp::placeholder{color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary,inherit));opacity:.85}',
  '.acx-inp{background:var(--dsw-alias-bg-layer-1,transparent);color:var(--dsw-alias-label-primary,inherit);border:1px solid var(--dsw-alias-border-l3,rgba(127,127,127,.35));border-radius:8px;padding:5px 8px;font:inherit;font-size:12px;box-sizing:border-box;flex:1 1 140px;min-width:0}',
  '.acx-sel{background:var(--dsw-alias-bg-layer-1,transparent);color:var(--dsw-alias-label-primary,inherit);border:1px solid var(--dsw-alias-border-l3,rgba(127,127,127,.35));border-radius:8px;padding:5px 7px;font:inherit;font-size:12px;box-sizing:border-box}',
  '.acx-btns{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
  '.acx-slist{display:flex;flex-direction:column;gap:5px;max-height:240px;overflow:auto;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.3));border-radius:9px;padding:6px}',
  '.acx-srow{display:flex;flex-direction:column;gap:2px;padding:6px 9px;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.3));border-radius:9px;cursor:pointer;background:var(--dsw-alias-bg-layer-1,transparent);text-align:left}',
  '.acx-srow:hover{border-color:var(--dsw-alias-brand-primary,#4d6bfe)}',
  '.acx-st{font-size:12.5px}',
  '.acx-sm{font-size:10.5px;color:var(--dsw-alias-label-secondary,inherit);word-break:break-all}',
  '.acx-empty{color:var(--dsw-alias-label-secondary,inherit);font-size:12px;padding:12px;text-align:center;max-width:520px;margin:0 auto}',
  '.acx-inline{border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.3));border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:7px;font-size:12.5px;background:var(--dsw-alias-bg-layer-1,transparent)}',
  '.acx-toast{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);z-index:40;max-width:86%;border:1px solid var(--dsw-alias-border-l3,rgba(127,127,127,.35));border-radius:10px;background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-layer-2,transparent));padding:7px 12px;font-size:12px;box-shadow:0 10px 26px rgba(0,0,0,.24)}',
  '.acx-errbox{border:1px solid var(--dsw-alias-state-error-primary,#d54941);border-radius:9px;padding:7px 9px;font-size:11.5px;color:var(--dsw-alias-state-error-primary,#d54941);white-space:pre-wrap;word-break:break-word}',
  '.acx-legend{position:absolute;left:10px;bottom:10px;z-index:11;display:flex;align-items:center;gap:8px;pointer-events:none;font-size:10.5px;color:var(--dsw-alias-label-secondary,inherit)}',
  '.acx-perf{position:absolute;right:10px;bottom:10px;z-index:12;min-width:236px;border:1px solid var(--dsw-alias-border-l3,rgba(127,127,127,.35));border-radius:10px;padding:8px 10px;font-size:10.5px;line-height:1.6;font-family:var(--dsw-font-mono,ui-monospace,Menlo,monospace);background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-layer-2,rgba(20,20,24,.9)));color:var(--dsw-alias-label-secondary,inherit);pointer-events:none;white-space:nowrap}',
  '.acx-perf-h{font-weight:600;color:var(--dsw-alias-label-primary,inherit);margin-bottom:2px}',
  '.acx-perf-n{margin-top:3px;opacity:.75;white-space:normal;max-width:250px}',
  '.acx-touch .acx-hover{display:none}',
  '.acx-touch .acx-form{max-height:48%}',
  '.acx-touch .acx-right{top:auto;left:8px;right:8px;bottom:8px;width:auto;height:min(56%,400px)}',
  '@media (max-width: 760px){',
  '.acx-right{top:auto;left:8px;right:8px;bottom:8px;width:auto;height:min(58%,420px)}',
  '.acx-side{max-height:70%}',
  '.acx-form{max-height:48%}',
  '.acx-bar{top:6px;left:6px;right:6px;padding:5px}',
  '.acx-btn{padding:7px 11px;font-size:12.5px}',
  '.acx-mini{padding:3px 7px;font-size:12px}',
  '.acx-sheet{max-height:66%}',
  '}',
].join('\n')
function merge(a, b) {
  const out = {}
  for (const k in a) out[k] = a[k]
  for (const k in b) out[k] = b[k]
  return out
}
function firstLine(text, max) {
  const raw = String(text === undefined || text === null ? '' : text).trim()
  if (!raw) return ''
  const lines = raw.split('\n')
  let out = ''
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim()
    if (t) { out = t; break }
  }
  if (out.length > max) out = out.slice(0, max) + '...'
  return out
}
function basename(p) {
  const s = String(p === undefined || p === null ? '' : p).replace(/\/+$/, '')
  const i = s.lastIndexOf('/')
  return i >= 0 ? s.slice(i + 1) : s
}
function dirname(p) {
  const s = String(p === undefined || p === null ? '' : p).replace(/\/+$/, '')
  const i = s.lastIndexOf('/')
  return i >= 0 ? s.slice(0, i) : '/'
}
function commonDir(paths) {
  if (!paths || paths.length === 0) return null
  const dirs = paths.map(function (p) { return dirname(p) })
  let parts = dirs[0].split('/')
  for (let i = 1; i < dirs.length; i++) {
    const other = dirs[i].split('/')
    let j = 0
    while (j < parts.length && j < other.length && parts[j] === other[j]) j += 1
    parts = parts.slice(0, j)
    if (parts.length === 0) return '/'
  }
  const joined = parts.join('/')
  return joined.length === 0 ? '/' : joined
}
function initials(name) {
  const s = String(name === undefined || name === null ? '' : name).trim()
  if (!s) return '?'
  const parts = s.split(/\s+/)
  if (parts.length >= 2 && parts[0] && parts[1]) return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase()
  return s.slice(0, 2).toUpperCase()
}
function fmtSize(n) {
  if (typeof n !== 'number' || !isFinite(n)) return ''
  if (n < 1024) return String(n) + 'B'
  if (n < 1048576) return (n / 1024).toFixed(1) + 'K'
  return (n / 1048576).toFixed(1) + 'M'
}
function extractPath(text) {
  const s = String(text === undefined || text === null ? '' : text)
  const m = /(^|[\s(\[])(\/[^\s"'()[\]]+)/.exec(s)
  if (!m) return null
  return m[2].replace(/[.,;:]+$/, '')
}
function slugify(text) {
  const raw = String(text === undefined || text === null ? '' : text).toLowerCase()
  let out = ''
  for (let i = 0; i < raw.length && out.length < 24; i++) {
    const c = raw.charAt(i)
    if ((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')) out += c
    else if (c === ' ' || c === '-' || c === '_' || c === '/') out += '-'
  }
  out = out.replace(/-+/g, '-').replace(/^-|-$/g, '')
  return out || 'agent'
}
function canvasCacheKey() {
  return 'agent-canvas/v1'
}
function loadCache() {
  try {
    if (typeof localStorage === 'undefined' || localStorage === null) return null
    const raw = localStorage.getItem(canvasCacheKey())
    if (typeof raw !== "string" || raw.length === 0) return null
    const doc = JSON.parse(raw)
    if (!doc || typeof doc !== "object") return null
    return doc
  } catch (e) {
    console.error('[agent-canvas] cache read failed', e)
    return null
  }
}
function saveCache(snapshot) {
  try {
    if (typeof localStorage === 'undefined' || localStorage === null) return false
    localStorage.setItem(canvasCacheKey(), JSON.stringify(snapshot))
    return true
  } catch (e) {
    console.error('[agent-canvas] cache write failed', e)
    return false
  }
}
function clearCache() {
  try {
    if (typeof localStorage === 'undefined' || localStorage === null) return
    localStorage.removeItem(canvasCacheKey())
  } catch (e) {}
}
function downloadText(name, text, mime) {
  try {
    const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.setTimeout(function () { URL.revokeObjectURL(url) }, 4000)
    return true
  } catch (e) {
    console.error('[agent-canvas] download failed', e)
    return false
  }
}
function buildExportDoc(st) {
  const agents = st.agents.map(function (a) {
    const files = st.files.filter(function (f) { return f.agentId === a.id })
    return {
      id: a.id,
      name: a.name,
      mission: a.mission || null,
      sessionId: a.sessionId || null,
      cwd: a.cwd || null,
      pending: a.pending === true,
      error: a.error || null,
      position: { x: Math.round(a.x), y: Math.round(a.y) },
      files: files.map(function (f) { return { path: f.path, rel: f.rel, type: f.type, size: f.size, isNew: f.isNew === true } }),
    }
  })
  const edges = []
  for (let i = 0; i < st.agents.length; i++) {
    const a = st.agents[i]
    const owned = st.files.filter(function (f) { return f.agentId === a.id })
    for (let j = 0; j < owned.length; j++) edges.push({ from: a.id, to: owned[j].path })
  }
  return {
    version: 1,
    kind: 'agent-canvas-export',
    exportedAt: new Date().toISOString(),
    workspace: st.workspace || null,
    mode: st.mode,
    counts: { agents: st.agents.length, files: st.files.length, edges: edges.length },
    agents: agents,
    edges: edges,
    fileNodes: st.files.map(function (f) {
      return { path: f.path, name: f.name, rel: f.rel, type: f.type, size: f.size, isNew: f.isNew === true, agentId: f.agentId || null }
    }),
  }
}
function buildMarkdown(st) {
  const L = []
  L.push('# Agent Canvas 导出')
  L.push('')
  L.push('- 工作区: ' + (st.workspace || '(未绑定)'))
  L.push('- 导出时间: ' + new Date().toISOString())
  L.push('- 统计: agent ' + String(st.agents.length) + ' / 文件节点 ' + String(st.files.length))
  L.push('')
  L.push('## Agents')
  L.push('')
  if (st.agents.length === 0) L.push('(none)')
  for (let i = 0; i < st.agents.length; i++) {
    const a = st.agents[i]
    L.push('### ' + a.name)
    L.push('')
    L.push('- 使命: ' + (a.mission ? String(a.mission).split('\n')[0] : '(未设置)'))
    L.push('- 会话: ' + (a.sessionId || '(未创建)'))
    L.push('- 工作目录: ' + (a.cwd || '(未知)'))
    if (a.error) L.push('- 错误: ' + a.error)
    const owned = st.files.filter(function (f) { return f.agentId === a.id })
    if (owned.length > 0) {
      L.push('- 负责文件:')
      for (let j = 0; j < owned.length; j++) L.push('  - `' + owned[j].path + '`')
    }
    L.push('')
  }
  L.push('## 全部文件节点')
  L.push('')
  for (let i = 0; i < st.files.length; i++) {
    const f = st.files[i]
    L.push('- `' + f.path + '`' + (f.isNew ? ' (new)' : ''))
  }
  L.push('')
  return L.join('\n')
}
function drawPng(st, posOf, AG) {
  const W = 1600
  const H = 1000
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const g = canvas.getContext('2d')
  if (!g) return null
  g.fillStyle = '#f7f8fa'
  g.fillRect(0, 0, W, H)
  g.font = '12px sans-serif'
  const pts = {}
  let minX = Infinity
  let minY = Infinity
  const consider = function (p) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
  }
  for (let i = 0; i < st.agents.length; i++) consider({ x: st.agents[i].x, y: st.agents[i].y })
  for (let i = 0; i < st.files.length; i++) consider(posOf(st.files[i]))
  if (!isFinite(minX)) { minX = 0; minY = 0 }
  const pad = 40
  for (let i = 0; i < st.agents.length; i++) {
    const a = st.agents[i]
    pts[a.id] = { x: a.x - minX + pad, y: a.y - minY + pad }
  }
  for (let i = 0; i < st.files.length; i++) {
    const f = st.files[i]
    const p = posOf(f)
    pts[f.path] = { x: p.x - minX + pad, y: p.y - minY + pad }
  }
  g.strokeStyle = '#c8ccd4'
  g.lineWidth = 1
  for (let i = 0; i < st.files.length; i++) {
    const f = st.files[i]
    if (!f.agentId || !pts[f.agentId] || !pts[f.path]) continue
    const a = pts[f.agentId]
    const b = pts[f.path]
    g.beginPath()
    g.moveTo(a.x + AG / 2, a.y + AG / 2)
    g.quadraticCurveTo((a.x + b.x) / 2 + AG / 2, (a.y + b.y) / 2 + AG / 2, b.x, b.y + 15)
    g.stroke()
  }
  for (let i = 0; i < st.files.length; i++) {
    const f = st.files[i]
    const p = pts[f.path]
    g.fillStyle = f.isNew ? '#e6f7ea' : '#ffffff'
    g.strokeStyle = f.isNew ? '#2ea043' : '#c8ccd4'
    g.beginPath()
    g.rect(p.x, p.y, 170, 30)
    g.fill()
    g.stroke()
    g.fillStyle = '#20303c'
    g.fillText(String(f.name).slice(0, 22), p.x + 6, p.y + 19)
  }
  for (let i = 0; i < st.agents.length; i++) {
    const a = st.agents[i]
    const p = pts[a.id]
    g.fillStyle = a.color || '#6366f1'
    g.beginPath()
    g.arc(p.x + AG / 2, p.y + AG / 2, AG / 2, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#ffffff'
    g.font = 'bold 16px sans-serif'
    g.textAlign = 'center'
    g.fillText(initials(a.name), p.x + AG / 2, p.y + AG / 2 + 6)
    g.textAlign = 'left'
    g.font = '12px sans-serif'
    g.fillStyle = '#20303c'
    g.fillText(String(a.name).slice(0, 20), p.x - 6, p.y + AG + 12)
  }
  g.fillStyle = '#6b7280'
  g.font = '11px sans-serif'
  g.fillText('Agent Canvas - ' + String(st.agents.length) + ' agents / ' + String(st.files.length) + ' files', 16, H - 16)
  return canvas
}
function detectTouch() {
  try {
    if (typeof window === 'undefined') return false
    if (typeof window.matchMedia !== 'function') return false
    return window.matchMedia('(hover: none), (pointer: coarse)').matches === true
  } catch (e) {
    return false
  }
}
function blocksText(content) {
  if (content === undefined || content === null) return ''
  const arr = Array.isArray(content) ? content : [content]
  const parts = []
  for (let i = 0; i < arr.length; i++) {
    const b = arr[i]
    if (!b || typeof b !== 'object') continue
    if (b.type === 'text' && typeof b.text === 'string') parts.push(b.text)
    else if (b.type === 'tool-call') parts.push('[tool] ' + String(b.name || 'tool'))
  }
  return parts.join('\n')
}
function mapWindow(win) {
  if (!win || !win.entries) return []
  const entries = win.entries
  const out = []
  const live = {}
  const liveOrder = []
  const start = entries.length > 300 ? entries.length - 300 : 0
  for (let i = start; i < entries.length; i++) {
    const ent = entries[i]
    if (!ent) continue
    if (ent.type === 'event') {
      const ev = ent.event
      if (!ev) continue
      const data = ev.data || {}
      if (ev.type === 'user/message') {
        out.push({ key: 's' + String(ev.seq), role: 'user', text: blocksText(data.content) })
      } else if (ev.type === 'assistant/message') {
        out.push({ key: 's' + String(ev.seq), role: 'assistant', text: blocksText(data.message && data.message.content) })
      } else if (ev.type === 'tool/call') {
        out.push({ key: 's' + String(ev.seq), role: 'tool', text: String(data.name || 'tool') })
      }
    } else if (ent.type === 'transient') {
      const ev = ent.event
      if (!ev || ev.type !== 'assistant/live-chunk' || !ev.data) continue
      const chunk = ev.data.chunk
      if (!chunk || chunk.type !== 'text-delta' || typeof chunk.text !== 'string') continue
      const aid = String(ev.data.attemptId)
      if (live[aid] === undefined) { live[aid] = ''; liveOrder.push(aid) }
      live[aid] = live[aid] + chunk.text
    }
  }
  for (let i = 0; i < liveOrder.length; i++) {
    const aid = liveOrder[i]
    out.push({ key: 'live-' + aid, role: 'assistant', text: live[aid], live: true })
  }
  return out
}
function curve(x1, y1, x2, y2) {
  const mx = (x1 + x2) / 2
  return 'M ' + x1 + ' ' + y1 + ' C ' + mx + ' ' + y1 + ' ' + mx + ' ' + y2 + ' ' + x2 + ' ' + y2
}
function createStore(initial) {
  let state = initial
  const listeners = []
  return {
    get: function () { return state },
    set: function (patch) {
      state = merge(state, patch)
      for (let i = 0; i < listeners.length; i++) {
        try { listeners[i]() } catch (e) { console.error('[agent-canvas] listener failed', e) }
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
return {
  apply(ctx) {
    let seq = 0
    function nextId(prefix) {
      seq += 1
      return prefix + '-' + String(seq)
    }
    const cached = loadCache() || {}
    const cachedAgents = (Array.isArray(cached.agents) ? cached.agents : []).map(function (a) {
      if (!a || typeof a !== 'object') return a
      return merge(a, { pending: false, error: a.sessionId ? null : (a.error || null) })
    })
    const cachedPositions = cached.positions && typeof cached.positions === "object" ? cached.positions : {}
    const store = createStore({
      agents: cachedAgents,
      files: [],
      agentSel: [],
      fileSel: [],
      activeAgentId: null,
      sessions: {},
      sessionList: [],
      dock: cached.dock === true,
      home: null,
      workspace: typeof cached.workspace === "string" ? cached.workspace : null,
      wsError: null,
      scanNote: null,
      lastScan: null,
      mode: cached.mode === 'agent' ? 'agent' : 'file',
      inspectId: null,
      inspectDir: null,
      manualVersion: 0,
    })
    const baselines = {}
    const manual = {}
    for (const k in cachedPositions) {
      const v = cachedPositions[k]
      if (v && typeof v.x === "number" && typeof v.y === "number") manual[k] = { x: v.x, y: v.y }
    }
    // revealed[dirPath] === true  => that directory was SPLIT OUT of its parent and is
    // now a node of its own. Empty at import: only each agent's cwd is a node.
    const revealed = {}
    const cachedRevealed = cached.revealed && typeof cached.revealed === "object" ? cached.revealed : {}
    for (const k in cachedRevealed) if (cachedRevealed[k] === true) revealed[k] = true
    let persistTimer = null
    function persist() {
      const s = store.get()
      const positions = {}
      for (const k in manual) positions[k] = { x: manual[k].x, y: manual[k].y }
      const agents = s.agents.map(function (a) {
        return { id: a.id, name: a.name, mission: a.mission, sessionId: a.sessionId, cwd: a.cwd, x: a.x, y: a.y, color: a.color, tag: a.tag }
      })
      const revealedOut = {}
      for (const k in revealed) revealedOut[k] = true
      saveCache({ version: 1, workspace: s.workspace, dock: s.dock, mode: s.mode, agents: agents, positions: positions, revealed: revealedOut, savedAt: Date.now() })
    }
    function persistSoon() {
      if (persistTimer !== null) return
      const timer = ctx.get("timer")
      if (timer === undefined || typeof timer.timeout !== "function") { persist(); return }
      persistTimer = timer.timeout(function () { persistTimer = null; persist() }, 800)
    }
    store.subscribe(persistSoon)
    // Every mutation of manual[] must go through here: the layout index is built in a
    // memo that cannot observe a plain object mutation, and manualVersion is its dep.
    function bumpManual() {
      store.set({ manualVersion: (store.get().manualVersion || 0) + 1 })
    }
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
    function findAgent(agents, id) {
      for (let i = 0; i < agents.length; i++) if (agents[i].id === id) return agents[i]
      return null
    }
    function toggleAgent(id) {
      const cur = store.get()
      const has = cur.agentSel.indexOf(id) >= 0
      store.set({
        agentSel: has ? cur.agentSel.filter(function (i) { return i !== id }) : cur.agentSel.concat([id]),
        activeAgentId: id,
      })
    }
    function toggleFile(path) {
      const cur = store.get()
      const has = cur.fileSel.indexOf(path) >= 0
      store.set({ fileSel: has ? cur.fileSel.filter(function (i) { return i !== path }) : cur.fileSel.concat([path]) })
    }
    function removeAgent(id) {
      const cur = store.get()
      store.set({
        agents: cur.agents.filter(function (a) { return a.id !== id }),
        agentSel: cur.agentSel.filter(function (i) { return i !== id }),
        activeAgentId: cur.activeAgentId === id ? null : cur.activeAgentId,
      })
    }
    function openInSidebar(sessionId) {
      if (!sessionId) return 'this agent has no session yet'
      const svc = ctx.get('sessions')
      if (svc === undefined || typeof svc.open !== 'function') return 'sessions service unavailable'
      try {
        svc.open(sessionId)
        return null
      } catch (e) {
        return String((e && e.message) || e)
      }
    }
    async function hostCall(method, args, timeoutMs) {
      const perfH0 = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()
      const call = Promise.resolve()
        .then(function () { return host.call(method, args) })
        .then(function (r) {
          return r === undefined || r === null ? { ok: false, error: 'empty response' } : r
        }, function (e) {
          return { ok: false, error: String((e && e.message) || e) }
        })
      const finish = function (r) {
        const h1 = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()
        const ms = h1 - perfH0
        PERF.hostCalls += 1
        PERF.hostTotalMs += ms
        if (ms >= PERF.hostMs) { PERF.hostMs = ms; PERF.hostMethod = method }
        PERF.hostAt = Date.now()
        return r
      }
      void finish
      if (!timeoutMs || timeoutMs <= 0) return call.then(finish)
      const timer = ctx.get('timer')
      if (timer === undefined || typeof timer.timeout !== 'function') return call
      const deadline = timer.timeout(timeoutMs).then(function () {
        return { ok: false, error: '超时 ' + String(timeoutMs) + 'ms：Host 没有响应', timeout: true }
      })
      return Promise.race([call, deadline])
    }
    async function sendToAgent(sessionId, text, mode) {
      const svc = ctx.get('sessions')
      let binding = null
      if (svc !== undefined && typeof svc.binding === 'function') {
        try { binding = svc.binding(sessionId) } catch (e) { binding = null }
      }
      if (binding && binding.session && typeof binding.session.prompt === 'function') {
        try {
          const res = await binding.session.prompt([{ type: 'text', text: text }], mode === 'steer' ? 'steer' : 'queue')
          if (res && (res.ok === true || res.accepted === true)) return { ok: true, via: 'session' }
          const err = res && res.error ? (res.error.message || res.error.code || 'rejected') : 'rejected'
          return { ok: false, error: String(err), via: 'session' }
        } catch (e) {
          return { ok: false, error: String((e && e.message) || e), via: 'session' }
        }
      }
      const r = await hostCall('canvas-send-prompt', { sessionId: sessionId, text: text, mode: mode === 'steer' ? 'steer' : 'queue' }, 20000)
      if (r.ok) return { ok: true, via: 'host' }
      return { ok: false, error: r.error || 'send failed', via: 'host' }
    }
    let refreshing = false
    let dragActive = false
    let lastFileScan = 0
    let lastScanRoot = null
    let lastRefreshSig = null
    let fileScanMs = 6000
    // On-canvas markdown preview cache: path -> text. Kept across refreshes so the
    // canvas does not refetch every poll; capped so a big tree cannot blow memory.
    const mdCache = {}
    const mdFetching = {}
    const MD_FETCH_MAX = 12
    const MD_MAX_LINES = 6
    const MD_MAX_CHARS = 4000
    async function refresh() {
      if (refreshing) return
      if (dragActive) return
      refreshing = true
      try {
        await refreshInner()
      } finally {
        refreshing = false
      }
    }
    async function refreshInner() {
      const cur = store.get()
      const sessRes = await hostCall('canvas-sessions', {}, 12000)
      const sessions = {}
      const sessionList = []
      if (sessRes.ok && sessRes.items) {
        for (let i = 0; i < sessRes.items.length; i++) {
          const s = sessRes.items[i]
          sessions[s.id] = s
          sessionList.push(s)
        }
      }
      const listOk = sessRes.ok === true
      const agents = []
      for (let i = 0; i < cur.agents.length; i++) {
        const a = cur.agents[i]
        const s = sessions[a.sessionId]
        const gone = listOk && a.sessionId && !s
        agents.push(s && s.cwd ? merge(a, { cwd: s.cwd, missing: gone }) : merge(a, { missing: gone }))
      }
      const ws = cur.workspace
      const files = []
      let note = null
      const now = Date.now()
      const dueScan = ws !== lastScanRoot || (now - lastFileScan) > fileScanMs
      if (ws && dueScan) {
        const scanStart = Date.now()
        const r = await hostCall('canvas-list-files', { path: ws, maxDepth: 8, limit: 4000 }, 20000)
        if (!r.ok) {
          note = '扫描 ' + ws + ' 失败: ' + (r.error || '')
          for (let i = 0; i < cur.files.length; i++) files.push(cur.files[i])
        } else {
          const entries = r.entries || []
          if (baselines[ws] === undefined) {
            const base = {}
            for (let j = 0; j < entries.length; j++) base[entries[j].path] = true
            baselines[ws] = base
          }
          for (let j = 0; j < entries.length; j++) {
            const e = entries[j]
            const prevMd = mdCache[e.path]
            files.push({
              path: e.path,
              name: e.name,
              rel: e.rel,
              type: e.type,
              size: e.size,
              agentId: ws ? WS_ID : null,
              root: ws,
              isNew: baselines[ws][e.path] !== true,
              mdText: typeof prevMd === 'string' ? prevMd : null,
            })
          }
          fetchMarkdown(files)
          if (r.truncated) note = ws + ' \u5185\u5bb9\u8fc7\u591a\uff0c\u4ec5\u663e\u793a\u524d 4000 \u9879'
          lastFileScan = now
          lastScanRoot = ws
          fileScanMs = Date.now() - scanStart > 400 ? 30000 : 6000
        }
      } else if (ws) {
        for (let i = 0; i < cur.files.length; i++) {
          const f = cur.files[i]
          files.push(merge(f, { agentId: ws ? WS_ID : null }))
        }
      } else {
        lastScanRoot = null
      }
      let sigAcc = 0
      for (let i = 0; i < files.length; i++) {
        const f = files[i]
        sigAcc = (sigAcc * 31 + f.path.length + (f.size === null ? 7 : f.size) + (f.isNew ? 1 : 0) + (f.agentId ? f.agentId.length : 0)) % 2147483647
      }
      let agSig = ''
      for (let i = 0; i < agents.length; i++) {
        const a = agents[i]
        agSig += a.id + (a.cwd || '') + (a.sessionId || '') + (a.pending ? 'p' : '') + (a.error ? 'e' : '') + (a.missing ? 'm' : '') + ';'
      }
      let liveSig = 0
      for (let i = 0; i < sessionList.length; i++) if (sessionList[i].live === true) liveSig += 1
      const sig = String(files.length) + '#' + String(sigAcc) + '#' + agSig + '#' + (note || '') + '#' + String(sessionList.length) + '#' + String(liveSig)
      if (sig === lastRefreshSig) return
      lastRefreshSig = sig
      store.set({ sessions: sessions, sessionList: sessionList, agents: agents, files: files, scanNote: note, lastScan: now })
    }
    // Read the first chunk of each .md node so drawGraph can show its content.
    // Bounded: at most MD_FETCH_MAX files, MD_MAX_CHARS each, never refetched.
    function fetchMarkdown(files) {
      let started = 0
      for (let i = 0; i < files.length; i++) {
        const f = files[i]
        if (!isMarkdown(f)) continue
        if (typeof mdCache[f.path] === 'string') { f.mdText = mdCache[f.path]; continue }
        if (mdFetching[f.path] === true) continue
        if (started >= MD_FETCH_MAX) continue
        started += 1
        mdFetching[f.path] = true
        hostCall('canvas-read-text', { path: f.path }, 8000).then(function (res) {
          mdFetching[f.path] = false
          if (res && res.ok && typeof res.text === 'string') {
            mdCache[f.path] = res.text.length > MD_MAX_CHARS ? res.text.slice(0, MD_MAX_CHARS) : res.text
            store.set({})
          }
        }, function () { mdFetching[f.path] = false })
      }
    }
    function assignOwner(agents, filePath) {
      let best = null
      let bestLen = -1
      for (let i = 0; i < agents.length; i++) {
        const cwd = agents[i].cwd
        if (!cwd) continue
        if (filePath === cwd || filePath.indexOf(cwd + '/') === 0) {
          if (cwd.length > bestLen) { bestLen = cwd.length; best = agents[i].id }
        }
      }
      return best
    }
    // -----------------------------------------------------------------------
    // FOLDER-GROUPED LAYOUT
    // Files are grouped the way a file manager groups them: every directory is a
    // labelled BOX on the canvas, and the files directly inside it are stacked in it.
    // Depth picks the column, sibling directories stack down that column.
    // A file with a manual position (manual[path]) is SPLIT OUT: it is drawn as an
    // independent node where it was dropped and no longer takes a slot in the box.
    // -----------------------------------------------------------------------
    const COL_W = FILE_W + 90
    const NODE_ROW_H = FILE_H + 10
    const MD_NODE_H = 118
    const BOX_PAD = 10
    const BOX_HEAD = 26
    const BOX_W = FILE_W + BOX_PAD * 2
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
    // The markdown body shown on the node: first MD_MAX_LINES non-empty lines.
    // Returns null while the text is still being fetched, so the node can say so.
    function mdLinesOf(f) {
      if (!f || typeof f.mdText !== 'string') return null
      const raw = f.mdText
      const out = []
      const lines = raw.split('\n')
      for (let i = 0; i < lines.length && out.length < MD_MAX_LINES; i++) {
        const t = lines[i]
        if (t === undefined || t === null) continue
        const trimmed = t.replace(/\s+$/, '')
        if (trimmed.length === 0) { if (out.length > 0) out.push(''); continue }
        out.push(trimmed)
      }
      while (out.length > 0 && out[out.length - 1] === '') out.pop()
      return out
    }
    // A file's path relative to the agent that owns it. Sections are keyed by this, so
    // two agents that both contain "src/app.ts" still get separate boxes.
    function relToAgentOf(file, owner) {
      const p = String((file && file.path) || '')
      const cwd = owner && owner.cwd ? String(owner.cwd) : ''
      if (cwd && (p === cwd || p.indexOf(cwd + '/') === 0)) {
        return p === cwd ? '' : p.slice(cwd.length + 1)
      }
      return String((file && (file.rel || file.name)) || p)
    }
    function useTranscript(agent) {
      const pair = React.useState({ messages: [], running: false, source: 'none', error: null })
      const state = pair[0]
      const setState = pair[1]
      const sessionId = agent && agent.sessionId ? agent.sessionId : null
      React.useEffect(function () {
        if (!sessionId) {
          setState({ messages: [], running: false, source: 'none', error: null })
          return
        }
        const svc = ctx.get('sessions')
        let binding = null
        if (svc !== undefined && typeof svc.binding === 'function') {
          try { binding = svc.binding(sessionId) } catch (e) { binding = null }
        }
        if (binding && binding.eventSource && typeof binding.eventSource.getSnapshot === 'function') {
          const read = function () {
            let win = null
            let snap = null
            try { win = binding.eventSource.getSnapshot() } catch (e) { win = null }
            try { snap = binding.session.getSnapshot() } catch (e) { snap = null }
            setState({ messages: mapWindow(win), running: !!(snap && snap.running), source: 'live', error: null })
          }
          read()
          const un1 = binding.eventSource.subscribe(read)
          const un2 = binding.session && typeof binding.session.subscribe === 'function' ? binding.session.subscribe(read) : null
          return function () { if (un1) un1(); if (un2) un2() }
        }
        let stopped = false
        const pollTick = function () {
          hostCall('canvas-read-session', { sessionId: sessionId }, 12000).then(function (r) {
            if (stopped) return
            if (r.ok) setState({ messages: r.messages || [], running: false, source: 'poll', error: null })
            else setState({ messages: [], running: false, source: 'poll', error: r.error || 'read failed' })
          })
        }
        pollTick()
        const timer = ctx.get('timer')
        let dispose = null
        if (timer !== undefined && typeof timer.interval === 'function') dispose = timer.interval(pollTick, 1800)
        return function () { stopped = true; if (dispose) dispose() }
      }, [sessionId])
      return state
    }
    function CanvasIcon(props) {
      const size = (props && props.size) || 18
      const color = props && props.active ? 'var(--dsw-alias-brand-primary,currentColor)' : 'currentColor'
      return h('svg', { width: size, height: size, viewBox: '0 0 20 20', fill: 'none', stroke: color, strokeWidth: 1.6, strokeLinecap: 'round' },
        h('circle', { cx: 4.2, cy: 5.2, r: 2.2 }),
        h('circle', { cx: 15.6, cy: 4.6, r: 2.2 }),
        h('circle', { cx: 9.6, cy: 15.4, r: 2.2 }),
        h('path', { d: 'M6.3 6.1l7.2-1.2M5.5 7.2l3.3 6.1M14.6 6.5l-3.5 6.6' }),
      )
    }
    function ChatDock(props) {
      const touchInput = !!(props && props.touch)
      const st = useStore()
      const t1 = React.useState('')
      const text = t1[0]
      const setText = t1[1]
      const m1 = React.useState('queue')
      const mode = m1[0]
      const setMode = m1[1]
      const b1 = React.useState(false)
      const busy = b1[0]
      const setBusy = b1[1]
      const r1 = React.useState([])
      const results = r1[0]
      const setResults = r1[1]
      const scrollRef = React.useRef(null)
      const targets = []
      for (let i = 0; i < st.agents.length; i++) {
        if (st.agentSel.indexOf(st.agents[i].id) >= 0) targets.push(st.agents[i])
      }
      const single = targets.length === 1 ? targets[0] : null
      const transcript = useTranscript(single)
      const msgs = transcript.messages
      const tail = msgs.length > 0 ? String(msgs[msgs.length - 1].text.length) : '0'
      const sig = String(msgs.length) + ':' + tail
      React.useEffect(function () {
        const el = scrollRef.current
        if (el) el.scrollTop = el.scrollHeight
      }, [sig, single ? single.id : 'none'])
      const pickedFiles = st.files.filter(function (f) { return st.fileSel.indexOf(f.path) >= 0 })
      const doSend = function () {
        const raw = text.trim()
        if (!raw || busy || targets.length === 0) return
        setBusy(true)
        const jobs = targets.map(function (a) {
          if (!a.sessionId) return Promise.resolve({ id: a.id, name: a.name, ok: false, error: 'no session bound' })
          const lines = ['[Canvas task]']
          if (a.mission) lines.push('Mission: ' + a.mission)
          if (a.cwd) lines.push('Working directory: ' + a.cwd)
          if (pickedFiles.length > 0) {
            lines.push('Selected files on canvas:')
            for (let i = 0; i < pickedFiles.length && i < 30; i++) lines.push('- ' + pickedFiles[i].path)
          }
          lines.push('')
          lines.push(raw)
          return sendToAgent(a.sessionId, lines.join('\n'), mode).then(function (r) {
            return { id: a.id, name: a.name, ok: !!r.ok, error: r.error || null, via: r.via }
          })
        })
        Promise.all(jobs).then(function (out) {
          setResults(out)
          setText('')
          setBusy(false)
        })
      }
      const head = h('div', { className: 'acx-dock-head' },
        h('span', null, '会话投影'),
        h('span', { className: 'acx-spacer' }),
        h('span', { className: 'acx-sm' }, targets.length === 0 ? '未选择 agent' : (targets.length === 1 ? '单聊' : '群发 ' + String(targets.length))),
        h('button', { className: 'acx-mini', onClick: function () { store.set({ dock: false }) } }, '收起'),
      )
      const chips = h('div', { className: 'acx-chips' },
        targets.length === 0
          ? h('span', { className: 'acx-sm' }, '点击 agent 选中；开「多选」或用 Ctrl/Cmd/Shift 可多选。悬停或点开 agent 可看它掌管的上下文范围。')
          : targets.map(function (a) {
              return h('span', { key: a.id, className: 'acx-chip' },
                h('span', { style: { color: a.color } }, '*'),
                h('span', null, a.name),
                h('button', { className: 'acx-mini', onClick: function () { toggleAgent(a.id) } }, 'x'),
              )
            }),
        h('span', { className: 'acx-spacer' }),
        h('button', { className: 'acx-mini', onClick: function () { store.set({ agentSel: store.get().agents.map(function (a) { return a.id }) }) } }, '全选'),
        h('button', { className: 'acx-mini', onClick: function () { store.set({ agentSel: [] }) } }, '清空'),
      )
      let body = null
      if (targets.length === 0) {
        body = h('div', { className: 'acx-empty' }, '选择一个或多个 agent 开始聊天。聊天直接投影自 DSH 会话，左侧栏会同步显示。')
      } else if (single) {
        const mine = st.files.filter(function (f) { return f.agentId === single.id })
        body = h('div', { className: 'acx-log', ref: scrollRef },
          h('div', { className: 'acx-row' },
            h('span', { className: 'acx-sm' }, 'session: ' + (single.sessionId || '无')),
            h('span', { className: 'acx-spacer' }),
            transcript.source === 'poll' ? h('span', { className: 'acx-sm' }, '轮询模式') : null,
            transcript.running ? h('span', { className: 'acx-sm acx-ok' }, '运行中') : null,
          ),
          h('div', { className: 'acx-sm' }, '工作目录: ' + (single.cwd || '未知') + ' · 画布上 ' + String(mine.length) + ' 个文件节点'),
          transcript.error ? h('div', { className: 'acx-errbox' }, transcript.error) : null,
          msgs.length === 0 ? h('div', { className: 'acx-sm' }, '(暂无消息)') : null,
          msgs.map(function (m) {
            return h('div', {
              key: m.key,
              className: 'acx-msg',
              'data-role': m.role,
              'data-live': m.live ? '1' : '0',
            }, m.role === 'tool' ? ('[tool] ' + m.text) : m.text)
          }),
        )
      } else {
        body = h('div', { className: 'acx-log' },
          h('div', { className: 'acx-hint' }, '群发模式：同一条 prompt 发给下列 ' + String(targets.length) + ' 个 agent，各自带上自己的工作目录与使命。'),
          targets.map(function (a) {
            return h('div', { key: a.id, className: 'acx-srow', onClick: function () { store.set({ agentSel: [a.id], activeAgentId: a.id }) } },
              h('div', { className: 'acx-st' }, h('span', { style: { color: a.color } }, '* '), a.name),
              h('div', { className: 'acx-sm' }, 'cwd: ' + (a.cwd || '未知')),
              h('div', { className: 'acx-sm' }, 'session: ' + (a.sessionId || '无')),
            )
          }),
        )
      }
      const foot = h('div', { className: 'acx-compose' },
        pickedFiles.length > 0 ? h('div', { className: 'acx-sm acx-warn' }, '已选 ' + String(pickedFiles.length) + ' 个文件会随消息一起发给每个 agent') : null,
        h('div', { className: 'acx-row' },
          h('select', { className: 'acx-sel', value: mode, onChange: function (e) { setMode(e.target.value) } },
            h('option', { value: 'queue' }, '排队 queue'),
            h('option', { value: 'steer' }, '插话 steer'),
          ),
          h('span', { className: 'acx-sm' }, busy ? '发送中...' : (touchInput ? '点发送按钮' : 'Enter 发送')),
          h('span', { className: 'acx-spacer' }),
          h('button', {
            className: 'acx-btn acx-primary',
            disabled: busy || !text.trim() || targets.length === 0,
            onClick: doSend,
          }, targets.length > 1 ? ('群发给 ' + String(targets.length) + ' 个') : '发送'),
        ),
        h('textarea', {
          className: 'acx-ta',
          style: { minHeight: '62px' },
          value: text,
          placeholder: '输入 prompt...',
          onChange: function (e) { setText(e.target.value) },
          onKeyDown: function (e) {
            if (touchInput) return
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend() }
          },
        }),
        results.length > 0 ? h('div', { className: 'acx-res' }, results.map(function (r) {
          return h('div', { key: r.id, className: r.ok ? 'acx-ok' : 'acx-err' },
            (r.ok ? 'OK ' : 'FAIL ') + r.name + (r.ok ? '' : ' - ' + r.error) + (r.via === 'host' ? ' (host)' : ''))
        })) : null,
        single ? h('div', { className: 'acx-row' },
          h('button', { className: 'acx-btn', onClick: function () {
            const err = openInSidebar(single.sessionId)
            if (err) console.error('[agent-canvas] open failed', err)
          } }, '在左侧打开'),
          h('button', { className: 'acx-btn', onClick: function () { forkAgent(single) } }, '分身 Fork'),
          h('span', { className: 'acx-spacer' }),
          h('button', { className: 'acx-btn acx-danger', onClick: function () { removeAgent(single.id) } }, '移除'),
        ) : null,
      )
      return h('div', { className: 'acx-dock' }, head, chips, body, foot)
    }
    async function forkAgent(agent) {
      if (!agent || !agent.sessionId) return { ok: false, error: 'this agent has no session yet' }
      const r = await hostCall('canvas-fork-session', { sessionId: agent.sessionId }, 20000)
      if (!r.ok) return { ok: false, error: r.error }
      const cur = store.get()
      const id = nextId('agent')
      const copy = merge(agent, {
        id: id,
        sessionId: r.sessionId,
        name: firstLine(agent.name + ' fork', 16),
        x: agent.x + 82,
        y: agent.y + 82,
        tag: 'fork',
      })
      store.set({ agents: cur.agents.concat([copy]), agentSel: [id], activeAgentId: id })
      return { ok: true }
    }
    function CanvasApp() {
      if (PERF.moves > 0) PERF.moveRenders += 1
      const st = useStore()
      const p1 = React.useState({ x: 36, y: 30 })
      const pan = p1[0]
      const setPan = p1[1]
      const g1 = React.useState(null)
      const draggingId = g1[0]
      const setDraggingId = g1[1]
      const fd1 = React.useState(null)
      const draggingFile = fd1[0]
      const setDraggingFile = fd1[1]
      const ha1 = React.useState(null)
      const hoverAgentId = ha1[0]
      const setHoverAgentId = ha1[1]
      const hf1 = React.useState(null)
      const hoverFile = hf1[0]
      const setHoverFile = hf1[1]
      const to1 = React.useState(null)
      const toast = to1[0]
      const setToast = to1[1]
      const z1 = React.useState(function () { return detectTouch() ? 0.75 : 1 })
      const zoom = z1[0]
      const setZoom = z1[1]
      const mm1 = React.useState(false)
      const multiMode = mm1[0]
      const setMultiMode = mm1[1]
      const tm1 = React.useState(function () { return detectTouch() })
      const touchMode = tm1[0]
      const setTouchMode = tm1[1]
      const inf1 = React.useState(null)
      const info = inf1[0]
      const setInfo = inf1[1]
      const f1 = React.useState(null)
      const form = f1[0]
      const setForm = f1[1]
      const f5 = React.useState(null)
      const formErr = f5[0]
      const setFormErr = f5[1]
      const f7 = React.useState([])
      const presets = f7[0]
      const setPresets = f7[1]
      const f8 = React.useState([])
      const sessionItems = f8[0]
      const setSessionItems = f8[1]
      const f9 = React.useState('')
      const projectQuery = f9[0]
      const setProjectQuery = f9[1]
      const wsp1 = React.useState('')
      const wsPath = wsp1[0]
      const setWsPath = wsp1[1]
      const wsb1 = React.useState(false)
      const wsBusy = wsb1[0]
      const setWsBusy = wsb1[1]
      const wsb2 = React.useState(null)
      const wsBrowse = wsb2[0]
      const setWsBrowse = wsb2[1]
      const wsb3 = React.useState([])
      const wsBrowseItems = wsb3[0]
      const setWsBrowseItems = wsb3[1]
      const wsb4 = React.useState(null)
      const pf1 = React.useState(false)
      const showPerf = pf1[0]
      const setShowPerf = pf1[1]
      const wsBrowseErr = wsb4[0]
      const setWsBrowseErr = wsb4[1]
      const canvasRef = React.useRef(null)
      const rootRef = React.useRef(null)
      const panRef = React.useRef(null)
      const dragRef = React.useRef(null)
      const fileDragRef = React.useRef(null)
      const pressedAgentRef = React.useRef(null)
      const viewRef = React.useRef({ x: 36, y: 30, z: 1 })
      const paletteRef = React.useRef(null)
      const liveRef = React.useRef(null)
      const interactionRef = React.useRef(null)
      const drawPendingRef = React.useRef(false)
      const drawRef = React.useRef(null)
      const computedHoverRef = React.useRef({ aid: null, fpath: null })
      const hoverPendingRef = React.useRef(null)
      // manualVersion is a DEPENDENCY on purpose: dragging a file mutates manual[],
      // which no memo can observe, so the mutation also bumps this counter.
      const idx = React.useMemo(function () {
        const filePosIndex = {}
        const fileByPath = {}
        const agentFileCount = {}
        const agentsById = {}
        const sections = []
        const sectionByKey = {}
        for (let i = 0; i < st.agents.length; i++) agentsById[st.agents[i].id] = st.agents[i]
        // The single tree root is the imported workspace, not each agent.
        if (st.workspace) agentsById[WS_ID] = { id: WS_ID, name: basename(st.workspace), cwd: st.workspace }
        function ensureSection(owner, dirRel) {
          const key = owner.id + '|' + dirRel
          let s = sectionByKey[key]
          if (s === undefined) {
            s = {
              key: key,
              agentId: owner.id,
              dirRel: dirRel,
              depth: dirRel === '' ? 0 : depthOfRel(dirRel),
              name: dirRel === '' ? (basename(owner.cwd || '') || '工作区根目录') : dirRel.slice(dirRel.lastIndexOf('/') + 1),
              parentKey: dirRel === '' ? null : (owner.id + '|' + dirOfRel(dirRel)),
              dirPath: null,
              files: [],
              total: 0,
              done: 0,
              x: 0, y: 0, w: BOX_W, h: BOX_HEAD + BOX_PAD,
            }
            sectionByKey[key] = s
            sections.push(s)
          }
          return s
        }
        // pass 1: index every path, then give a section ONLY to visible directories:
        // each agent's cwd root, plus directories already SPLIT OUT of a parent.
        for (let i = 0; i < st.files.length; i++) fileByPath[st.files[i].path] = st.files[i]
        if (agentsById[WS_ID] !== undefined) {
          const rootSec = ensureSection(agentsById[WS_ID], '')
          rootSec.dirPath = st.workspace
        }
        for (let i = 0; i < st.files.length; i++) {
          const f = st.files[i]
          if (f.type !== 'directory') continue
          if (revealed[f.path] !== true) continue
          const owner = agentsById[WS_ID]
          if (owner === undefined) continue
          const own = ensureSection(owner, relToAgentOf(f, owner))
          own.dirPath = f.path
        }
        // pass 2: a folder node is COLLAPSED. Count its direct children (files AND
        // subfolders) and how many were already split out; place none of them here.
        for (let i = 0; i < st.files.length; i++) {
          const f = st.files[i]
          const owner = f.agentId ? agentsById[f.agentId] : null
          if (!owner) continue
          const s = sectionByKey[owner.id + '|' + dirOfRel(relToAgentOf(f, owner))]
          if (s === undefined) continue
          s.total += 1
          const done = f.type === 'directory' ? (revealed[f.path] === true) : (manual[f.path] !== undefined)
          if (done) s.done += 1
        }
        for (let i = 0; i < st.files.length; i++) {
          const f = st.files[i]
          if (!f.agentId) continue
          const cnt = agentFileCount[f.agentId]
          if (cnt === undefined) agentFileCount[f.agentId] = { total: 1, fresh: f.isNew ? 1 : 0 }
          else { cnt.total += 1; if (f.isNew) cnt.fresh += 1 }
        }
        // place: depth picks the column, sections of one column stack downward
        sections.sort(function (a, b) {
          if (a.agentId !== b.agentId) return a.agentId < b.agentId ? -1 : 1
          if (a.depth !== b.depth) return a.depth - b.depth
          return a.dirRel < b.dirRel ? -1 : (a.dirRel > b.dirRel ? 1 : 0)
        })
        const cursor = {}
        for (let i = 0; i < sections.length; i++) {
          const s = sections[i]
          const owner = agentsById[s.agentId]
          if (!owner) continue
          const ck = s.agentId + '|' + s.depth
          const y0 = cursor[ck] === undefined ? 0 : cursor[ck]
          const ox = owner && typeof owner.x === 'number' ? owner.x : 40
          const oy = owner && typeof owner.y === 'number' ? owner.y : 40
          s.x = ox + 150 + s.depth * COL_W
          s.y = oy - 30 + y0
          let hh = BOX_HEAD + BOX_PAD
          for (let j = 0; j < s.files.length; j++) hh += nodeH(s.files[j]) + 8
          s.h = hh < BOX_HEAD + BOX_PAD + 24 ? BOX_HEAD + BOX_PAD + 24 : hh
          cursor[ck] = y0 + s.h + 26
          let yy = s.y + BOX_HEAD
          for (let j = 0; j < s.files.length; j++) {
            const f = s.files[j]
            filePosIndex[f.path] = { x: s.x + BOX_PAD, y: yy }
            yy += nodeH(f) + 8
          }
        }
        // Every box must be identifiable even when its directory was never listed as an
        // entry (an agent whose cwd IS the workspace root, or a skipped dir). Without
        // this the box is drawn but cannot be clicked or split.
        for (let i = 0; i < sections.length; i++) {
          const s = sections[i]
          if (s.dirPath !== null) continue
          const owner = agentsById[s.agentId]
          if (!owner) continue
          const abs = s.dirRel === '' ? String(owner.cwd || '') : (owner.cwd ? String(owner.cwd) + '/' + s.dirRel : s.dirRel)
          if (!abs) continue
          s.dirPath = abs
          if (fileByPath[abs] === undefined) {
            fileByPath[abs] = {
              path: abs, name: s.name, rel: s.dirRel, type: 'directory',
              size: null, agentId: s.agentId, root: st.workspace, isNew: false, mdText: null,
            }
          }
        }
        // a directory NODE is represented by its box, so it still hit-tests and hovers
        for (let i = 0; i < st.files.length; i++) {
          const f = st.files[i]
          if (f.type !== 'directory') continue
          const owner = f.agentId ? agentsById[f.agentId] : null
          if (!owner) continue
          const s = sectionByKey[owner.id + '|' + relToAgentOf(f, owner)]
          if (s !== undefined) filePosIndex[f.path] = { x: s.x, y: s.y, w: s.w, h: s.h }
        }
        // Files with no owning agent are NOT placed: every node on the canvas belongs
        // to exactly one agent's scope (its own cwd subtree). No global/loose column.
        return {
          filePosIndex: filePosIndex,
          fileByPath: fileByPath,
          agentFileCount: agentFileCount,
          agentsById: agentsById,
          sections: sections,
          sectionByKey: sectionByKey,
        }
      }, [st.files, st.agents, st.manualVersion])
      const filePosIndex = idx.filePosIndex
      const fileByPath = idx.fileByPath
      const agentFileCount = idx.agentFileCount
      const agentsById = idx.agentsById
      const sections = idx.sections
      const sectionByKey = idx.sectionByKey
      React.useEffect(function () {
        let stopped = false
        const ui = ctx.get('uiWorkspace')
        if (ui !== undefined && typeof ui.listDirectory === 'function') {
          Promise.resolve(ui.listDirectory()).then(function (listing) {
            if (listing && typeof listing.home === 'string') store.set({ home: listing.home })
          }, function () {})
        }
        refresh()
        hostCall('canvas-presets', {}, 12000).then(function (r) {
          if (r && r.ok && r.items) setPresets(r.items)
        }, function () {})
        const timer = ctx.get('timer')
        let dispose = null
        const schedule = function () {
          if (stopped) return
          if (timer !== undefined && typeof timer.timeout === 'function') {
            dispose = timer.timeout(function () {
              Promise.resolve(refresh()).then(schedule, schedule)
            }, 15000)
          }
        }
        if (timer !== undefined && typeof timer.timeout === 'function') schedule()
        // 进入 canvas 时自动折叠左栏，把宽度让给图。只在左栏确实展开、且窗口足够宽时做一次。
        if (typeof window !== 'undefined' && (window.innerWidth || 0) >= 1024 && sidebarLooksExpanded()) {
          toggleLeftSidebar()
        }
        return function () { stopped = true; if (dispose) dispose() }
      }, [])
      React.useEffect(function () {
        viewRef.current.x = pan.x
        viewRef.current.y = pan.y
        viewRef.current.z = zoom
        if (paletteRef.current === null || Date.now() - paletteStamp > 1000) {
          paletteRef.current = readPalette()
          paletteStamp = Date.now()
        }
        drawRef.current = drawGraph
        drawGraph()
      }, [st, pan, zoom, hoverAgentId, hoverFile, draggingId, draggingFile])
      React.useEffect(function () {
        const el = canvasRef.current
        const onResize = function () { scheduleDraw() }
        let ro = null
        try {
          if (el && typeof ResizeObserver === 'function') {
            ro = new ResizeObserver(onResize)
            ro.observe(el)
          } else if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
            window.addEventListener('resize', onResize)
          }
        } catch (e) {}
        scheduleDraw()
        return function () {
          try {
            if (ro) ro.disconnect()
            else if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') window.removeEventListener('resize', onResize)
          } catch (e) {}
        }
      }, [])
      React.useEffect(function () {
        if (!toast) return
        const timer = ctx.get('timer')
        let dispose = null
        if (timer !== undefined && typeof timer.timeout === 'function') dispose = timer.timeout(function () { setToast(null) }, 5000)
        return function () { if (dispose) dispose() }
      }, [toast])
      React.useEffect(function () {
        let query = null
        let onChange = null
        try {
          if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined
          query = window.matchMedia('(hover: none), (pointer: coarse)')
          onChange = function () { setTouchMode(query.matches === true) }
          if (typeof query.addEventListener === 'function') query.addEventListener('change', onChange)
          else if (typeof query.addListener === 'function') query.addListener(onChange)
        } catch (e) {
          return undefined
        }
        return function () {
          try {
            if (query === null || onChange === null) return
            if (typeof query.removeEventListener === 'function') query.removeEventListener('change', onChange)
            else if (typeof query.removeListener === 'function') query.removeListener(onChange)
          } catch (e) {}
        }
      }, [])
      React.useEffect(function () {
        if (!form) return
        let alive = true
        if (form.kind === 'project') {
          hostCall('canvas-sessions', { titles: true, titleLimit: 20 }, 30000).then(function (r) {
            if (!alive) return
            if (r.ok) { setSessionItems(r.items || []); setFormErr(null) }
            else setFormErr(r.error || 'list failed')
          })
          return function () { alive = false }
        }
        return undefined
      }, [form])
      function pointIn(rect, e) {
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
        const ck = String(g.font) + '|' + String(Math.round(maxW)) + '|' + s
        const hit = clipCache[ck]
        if (hit !== undefined) return hit
        const out = clipTextUncached(g, s, maxW)
        if (clipCacheSize > 4000) { for (const k in clipCache) delete clipCache[k]; clipCacheSize = 0 }
        clipCache[ck] = out
        clipCacheSize += 1
        return out
      }
      function clipTextUncached(g, s, maxW) {
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
        const perfT0 = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()
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
        // Hover highlight: an agent lights up its whole cwd scope; hovering a folder
        // lights up that folder's subtree (path prefix), not the whole tree.
        let scopePath = null
        if (hoverAgentId !== null) {
          const ha = agentsById[hoverAgentId]
          if (ha !== undefined && ha.cwd) scopePath = String(ha.cwd)
        } else if (hoverFile !== null && fileByPath[hoverFile] !== undefined) {
          scopePath = fileByPath[hoverFile].path
        }
        function inScope(p) {
          if (scopePath === null || typeof p !== 'string') return false
          return p === scopePath || p.indexOf(scopePath + '/') === 0
        }
        let drawn = 0
        // edges: agent -> its top-level folders, and each folder -> its subfolders
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
            if (!owner || typeof owner.x !== 'number') continue
            const ap = agentPosOf(owner)
            x1 = ap.x + AGENT_SIZE / 2
            y1 = ap.y + AGENT_SIZE / 2
          } else {
            x1 = ps.x + ps.w
            y1 = ps.y + 14
          }
          const box = { x: Math.min(x1, x2) - 2, y: Math.min(y1, y2) - 2, w: Math.abs(x2 - x1) + 4, h: Math.abs(y2 - y1) + 4 }
          if (!vis(box.x, box.y, box.w, box.h)) continue
          const eHl = inScope(s.dirPath)
          g.lineWidth = eHl ? 2 : 1.5
          g.strokeStyle = eHl ? pal.accent : pal.line
          const mx = (x1 + x2) / 2
          g.beginPath()
          g.moveTo(x1, y1)
          g.bezierCurveTo(mx, y1, mx, y2, x2, y2)
          g.stroke()
        }
        g.setLineDash([])
        // edges: each split-out file node hangs off its parent folder node
        for (const fp in manual) {
          const f = fileByPath[fp]
          if (f === undefined || f.type === 'directory' || !f.agentId) continue
          const pos = manual[fp]
          const sec = sectionOf(dirOfPath(fp))
          if (sec === null) continue
          const x1 = sec.x + sec.w
          const y1 = sec.y + 14
          const y2 = pos.y + 14
          const hl = inScope(f.path)
          g.lineWidth = hl ? 2 : 1.5
          g.strokeStyle = hl ? pal.accent : pal.line
          g.beginPath()
          g.moveTo(x1, y1)
          const mx = (x1 + pos.x) / 2
          g.bezierCurveTo(mx, y1, mx, y2, pos.x, y2)
          g.stroke()
        }
        g.setLineDash([])
        // folder nodes: one collapsed card per directory (no children drawn inside)
        for (let i = 0; i < sections.length; i++) {
          const s = sections[i]
          if (!vis(s.x, s.y, s.w, s.h)) continue
          roundRectPath(g, s.x, s.y, s.w, s.h, 12)
          g.fillStyle = pal.dirBg
          g.fill()
          const sHl = inScope(s.dirPath)
          g.lineWidth = sHl ? 2 : 1
          g.strokeStyle = (sHl || st.fileSel.indexOf(s.dirPath) >= 0) ? pal.accent : pal.border
          g.stroke()
          g.font = '11.5px ' + FONT_STACK
          g.fillStyle = pal.label
          g.fillText(clipText(g, '[D] ' + s.name, s.w - 66), s.x + 10, s.y + 15)
          g.font = '10px ' + FONT_STACK
          g.fillStyle = pal.dim
          g.textAlign = 'right'
          g.fillText(String(s.total - s.done) + ' / ' + String(s.total) + ' 项', s.x + s.w - 10, s.y + 15)
          g.textAlign = 'left'
        }
        // file nodes
        g.textBaseline = 'middle'
        g.textAlign = 'left'
        for (let i = 0; i < st.files.length; i++) {
          const f = st.files[i]
          if (f.type === 'directory') continue
          if (!f.agentId) continue
          if (manual[f.path] === undefined && filePosIndex[f.path] === undefined) continue
          const p = livePosOf(f)
          const nh = nodeH(f)
          if (!vis(p.x, p.y, FILE_W, nh)) continue
          drawn += 1
          const isDir = false
          const isMd = isMarkdown(f)
          roundRectPath(g, p.x, p.y, FILE_W, nh, 9)
          g.fillStyle = isDir ? pal.dirBg : pal.fileBg
          g.fill()
          g.lineWidth = 1
          g.strokeStyle = f.isNew ? pal.fresh : pal.border
          g.stroke()
          if (st.fileSel.indexOf(f.path) >= 0 || inScope(f.path)) {
            roundRectPath(g, p.x - 1.5, p.y - 1.5, FILE_W + 3, nh + 3, 10)
            g.lineWidth = 2
            g.strokeStyle = pal.accent
            g.stroke()
          }
          // header
          g.font = '11.5px ' + FONT_STACK
          g.fillStyle = pal.label
          g.fillText(clipText(g, (isDir ? '[D] ' : '[F] ') + f.name, FILE_W - 16), p.x + 8, p.y + 15)
          if (f.isNew) {
            g.fillStyle = pal.fresh
            g.textAlign = 'right'
            g.fillText('new', p.x + FILE_W - 8, p.y + 15)
            g.textAlign = 'left'
          }
          if (isMd) {
            // A named markdown file shows its OWN CONTENT on the node.
            g.beginPath()
            g.moveTo(p.x + 8, p.y + 26)
            g.lineTo(p.x + FILE_W - 8, p.y + 26)
            g.lineWidth = 1
            g.strokeStyle = pal.border
            g.stroke()
            const lines = mdLinesOf(f)
            g.font = '9.5px ' + FONT_STACK
            if (lines === null) {
              g.fillStyle = pal.dim
              g.fillText(clipText(g, '\u8bfb\u53d6\u4e2d\u2026', FILE_W - 18), p.x + 8, p.y + 40)
            } else if (lines.length === 0) {
              g.fillStyle = pal.dim
              g.fillText(clipText(g, '(\u7a7a\u6587\u4ef6)', FILE_W - 18), p.x + 8, p.y + 40)
            } else {
              for (let k = 0; k < lines.length; k++) {
                const ly = p.y + 40 + k * 12
                if (ly > p.y + nh - 6) break
                g.fillStyle = k === 0 ? pal.label : pal.dim
                g.fillText(clipText(g, lines[k], FILE_W - 18), p.x + 8, ly)
              }
            }
          } else {
            g.font = '10px ' + FONT_STACK
            g.fillStyle = pal.dim
            g.fillText(clipText(g, f.rel || f.name, FILE_W - 18), p.x + 8, p.y + 32)
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
        if (PERF.drawn !== drawn) PERF.drawn = drawn
        const perfT1 = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()
        PERF.drawMs = Math.round((perfT1 - perfT0) * 100) / 100
        if (PERF.drawMs > PERF.drawMax) PERF.drawMax = PERF.drawMs
        perfFrame()
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
          if (f.type === 'directory') continue
          if (manual[f.path] === undefined && filePosIndex[f.path] === undefined) continue
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
        PERF.moves += 1
        const it = interactionRef.current
        if (it === null) return
        if (it.kind === 'pan') {
          it.x = it.px + (e.clientX - it.sx)
          it.y = it.py + (e.clientY - it.sy)
          viewRef.current.x = it.x
          viewRef.current.y = it.y
          try { if (e.currentTarget.dataset.panning !== '1') e.currentTarget.dataset.panning = '1' } catch (err) {}
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
      function flushHover() {
        hoverPendingRef.current = null
        const h2 = computedHoverRef.current
        if (h2.aid !== hoverAgentId) setHoverAgentId(h2.aid)
        if (h2.fpath !== hoverFile) setHoverFile(h2.fpath)
      }
      function onGraphHover(e) {
        if (interactionRef.current !== null) return
        const rect = canvasRect()
        const p = pointIn(rect, e)
        const hit = hitTest(p.x, p.y)
        const aid = hit !== null && hit.kind === 'agent' ? hit.agent.id : null
        const fpath = hit !== null && hit.kind === 'file' ? hit.file.path : null
        computedHoverRef.current = { aid: aid, fpath: fpath }
        if (hoverPendingRef.current !== null) return
        const timer = ctx.get('timer')
        if (timer === undefined || typeof timer.timeout !== 'function') { flushHover(); return }
        hoverPendingRef.current = timer.timeout(flushHover, 90)
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
            // dropping a file here SPLITS it out of its folder box: it keeps this spot
            // as an independent node instead of a slot in the box.
            manual[it.path] = { x: it.x, y: it.y }
            bumpManual()
            return
          }
          const f2 = fileByPath[it.path]
          if (f2 !== undefined && f2.type === 'directory') {
            // 点击文件夹 -> 右侧面板可以对它做 split
            store.set({ inspectDir: it.path, inspectId: null })
          } else {
            toggleFile(it.path)
            if (touchMode) setInfo({ kind: 'file', path: it.path })
          }
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
        const z0 = viewRef.current.z
        let nz = Math.round(z0 * step * 100) / 100
        if (nz < 0.3) nz = 0.3
        if (nz > 2.5) nz = 2.5
        if (nz === z0) return
        const rect = el.getBoundingClientRect()
        const mx = e.clientX - rect.left
        const my = e.clientY - rect.top
        setPan({ x: mx - (mx - pan.x) * (nz / z0), y: my - (my - pan.y) * (nz / z0) })
        setZoom(nz)
      }
      // ---- LEFT SIDEBAR AUTO-COLLAPSE ---------------------------------------
      // ctx.layout only exposes a blind toggleSidebar(), so read the current state
      // from our OWN panel: the main column starts right after the sidebar, so its
      // left offset is the sidebar width. On a narrow frame the sidebar is an
      // overlay and our offset stays ~0, which correctly means "leave it alone".
      function sidebarLooksExpanded() {
        const el = rootRef.current
        if (!el || typeof el.getBoundingClientRect !== 'function') return false
        try {
          const r = el.getBoundingClientRect()
          return r.left > 120
        } catch (e) {
          return false
        }
      }
      function toggleLeftSidebar() {
        const layout = ctx.get('layout')
        if (layout === undefined || typeof layout.toggleSidebar !== 'function') {
          setToast({ id: nextId('t'), text: '当前界面没有提供左栏折叠接口' })
          return
        }
        try {
          layout.toggleSidebar()
        } catch (e) {
          setToast({ id: nextId('t'), text: String((e && e.message) || e) })
        }
      }
      // ---- ZOOM -------------------------------------------------------------
      // Valid range 0.3x .. 2.5x. zoomTo keeps the given screen point (anchor) fixed
      // while the scale changes, which is what makes wheel zoom feel anchored to the
      // cursor instead of drifting.
      function clampZoom(z) {
        if (!(z > 0)) return 1
        if (z < 0.3) return 0.3
        if (z > 2.5) return 2.5
        return Math.round(z * 100) / 100
      }
      function zoomTo(nz, ax, ay) {
        const z0 = viewRef.current.z
        const nzc = clampZoom(nz)
        if (nzc === z0) return
        const px = viewRef.current.x
        const py = viewRef.current.y
        const nx = ax - (ax - px) * (nzc / z0)
        const ny = ay - (ay - py) * (nzc / z0)
        viewRef.current.z = nzc
        viewRef.current.x = nx
        viewRef.current.y = ny
        setZoom(nzc)
        setPan({ x: nx, y: ny })
      }
      function zoomStep(factor) {
        const el = canvasRef.current
        const w = el && el.clientWidth ? el.clientWidth : 800
        const h = el && el.clientHeight ? el.clientHeight : 600
        zoomTo(viewRef.current.z * factor, w / 2, h / 2)
      }
      // Fit every node into view, with padding. This is the "看全" control.
      function fitToContent() {
        const el = canvasRef.current
        const w = el && el.clientWidth ? el.clientWidth : 800
        const h = el && el.clientHeight ? el.clientHeight : 600
        let minX = Infinity
        let minY = Infinity
        let maxX = -Infinity
        let maxY = -Infinity
        function see(x, y, ww, hh) {
          if (x < minX) minX = x
          if (y < minY) minY = y
          if (x + ww > maxX) maxX = x + ww
          if (y + hh > maxY) maxY = y + hh
        }
        for (let i = 0; i < st.agents.length; i++) {
          const a = st.agents[i]
          see(a.x, a.y, AGENT_SIZE, AGENT_SIZE + 14)
        }
        for (let i = 0; i < st.files.length; i++) {
          const f = st.files[i]
          if (f.type === 'directory') continue
          if (!f.agentId) continue
          if (manual[f.path] === undefined && filePosIndex[f.path] === undefined) continue
          const p = filePosOf(f)
          see(p.x, p.y, FILE_W, nodeH(f))
        }
        for (let i = 0; i < sections.length; i++) see(sections[i].x, sections[i].y, sections[i].w, sections[i].h)
        if (minX === Infinity) { setPan({ x: 36, y: 30 }); setZoom(1); return }
        const pad = 40
        const cw = Math.max(1, maxX - minX)
        const ch = Math.max(1, maxY - minY)
        const nz = clampZoom(Math.min((w - pad * 2) / cw, (h - pad * 2) / ch))
        viewRef.current.z = nz
        viewRef.current.x = pad - minX * nz
        viewRef.current.y = pad - minY * nz
        setZoom(nz)
        setPan({ x: viewRef.current.x, y: viewRef.current.y })
      }
      // manual[] first: a hand drag (or a split) always beats the computed slot, and
      // this is what makes a dropped file stay where it was dropped.
      function filePosOf(f) {
        if (!f) return { x: 60, y: 60 }
        const m = manual[f.path]
        if (m !== undefined) return m
        const p = filePosIndex[f.path]
        return p === undefined ? { x: 60, y: 60 } : p
      }
      // Direct files of one folder, relative to the agent that owns it.
      function dirChildren(dirPath) {
        const dir = fileByPath[dirPath]
        if (dir === undefined) return []
        const owner = findAgent(st.agents, dir.agentId)
        const want = relToAgentOf(dir, owner)
        const out = []
        for (let i = 0; i < st.files.length; i++) {
          const f = st.files[i]
          if (f.type === 'directory') continue
          if (f.agentId !== dir.agentId) continue
          if (dirOfRel(relToAgentOf(f, owner)) !== want) continue
          out.push(f)
        }
        return out
      }
      function dirOfPath(p) {
        const i = String(p).lastIndexOf('/')
        return i <= 0 ? '' : String(p).slice(0, i)
      }
      // Direct children of a folder: BOTH subfolders and files, folders first.
      function dirEntries(dirPath) {
        const out = []
        for (let i = 0; i < st.files.length; i++) {
          const f = st.files[i]
          if (f.path === dirPath) continue
          if (dirOfPath(f.path) !== dirPath) continue
          out.push(f)
        }
        out.sort(function (a, b) {
          if ((a.type === 'directory') !== (b.type === 'directory')) return a.type === 'directory' ? -1 : 1
          return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0)
        })
        return out
      }
      // SPLIT exactly ONE child out of a folder. A folder child becomes its own folder
      // node (revealed); a file child becomes a free file node (manual position).
      // There is deliberately no "split all" - every node is one split.
      function splitChild(dirPath, childPath, isDir) {
        if (isDir) {
          if (revealed[childPath] === true) return
          revealed[childPath] = true
          bumpManual()
          setToast({ id: nextId('t'), text: '已分裂文件夹 ' + basename(childPath) })
          return
        }
        if (manual[childPath] !== undefined) return
        const sec = sectionOf(dirPath)
        let n = 0
        for (const k in manual) { const f2 = fileByPath[k]; if (f2 !== undefined && dirOfPath(f2.path) === dirPath) n += 1 }
        const ox = sec !== null ? sec.x + sec.w + 60 : 400
        const oy = (sec !== null ? sec.y : 300) + n * (FILE_H + 18)
        manual[childPath] = { x: ox, y: oy }
        bumpManual()
        setToast({ id: nextId('t'), text: '已分裂 ' + basename(childPath) })
      }
      function unsplitDir(dirPath) {
        const kids = dirEntries(dirPath)
        let n = 0
        for (let i = 0; i < kids.length; i++) {
          const k = kids[i]
          if (k.type === 'directory') { if (revealed[k.path] === true) { delete revealed[k.path]; n += 1 } }
          else if (manual[k.path] !== undefined) { delete manual[k.path]; n += 1 }
        }
        if (n === 0) {
          setToast({ id: nextId('t'), text: '这个文件夹没有已分裂的子节点' })
          return
        }
        bumpManual()
        setToast({ id: nextId('t'), text: '已收回 ' + String(n) + ' 个节点' })
      }
      function sectionOf(dirPath) {
        for (let i = 0; i < sections.length; i++) if (sections[i].dirPath === dirPath) return sections[i]
        return null
      }
      function exportStamp() {
        return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      }
      function exportJson() {
        const st0 = store.get()
        const doc = buildExportDoc(st0)
        const ok = downloadText(
          'agent-canvas-' + exportStamp() + '.json',
          JSON.stringify(doc, null, 2),
          'application/json',
        )
        setToast({ id: nextId('t'), text: ok ? '已导出 JSON' : '导出失败' })
      }
      function exportMarkdown() {
        const st0 = store.get()
        const md = buildMarkdown(st0)
        const ok = downloadText(
          'agent-canvas-' + exportStamp() + '.md',
          md,
          'text/markdown;charset=utf-8',
        )
        setToast({ id: nextId('t'), text: ok ? '已导出 Markdown' : '导出失败' })
      }
      async function exportMarkdownToWorkspace() {
        const st0 = store.get()
        if (!st0.workspace) {
          setToast({ id: nextId('t'), text: '请先绑定工作区' })
          return
        }
        const md = buildMarkdown(st0)
        const target = st0.workspace.replace(/\/+$/, '') + '/AGENT-CANVAS.md'
        const r = await hostCall('canvas-export-file', { path: target, content: md }, 15000)
        if (r.ok) {
          setToast({ id: nextId('t'), text: '已写入 ' + target })
          return
        }
        const saved = downloadText('agent-canvas-' + exportStamp() + '.md', md, 'text/markdown;charset=utf-8')
        setToast({ id: nextId('t'), text: saved
          ? ('写入工作区失败（' + (r.error || '') + '），已改为下载')
          : ('写入失败: ' + (r.error || '')) })
      }
      function exportPng() {
        const st0 = store.get()
        const posOf = function (f) {
          const owner = findAgent(st0.agents, f.agentId)
          let index = 0
          let seen = 0
          for (let i = 0; i < st0.files.length; i++) {
            if (st0.files[i].agentId !== f.agentId) continue
            if (st0.files[i].path === f.path) { index = seen; break }
            seen += 1
          }
          if (!owner) return { x: 60, y: 60 }
          return filePos(owner, index, f)
        }
        let canvas = null
        try {
          canvas = drawPng(st0, posOf, AGENT_SIZE)
        } catch (e) {
          canvas = null
        }
        if (!canvas) {
          setToast({ id: nextId('t'), text: '生成图片失败' })
          return
        }
        try {
          const url = canvas.toDataURL('image/png')
          const a = document.createElement('a')
          a.href = url
          a.download = 'agent-canvas-' + exportStamp() + '.png'
          document.body.appendChild(a)
          a.click()
          a.remove()
          setToast({ id: nextId('t'), text: '已导出 PNG' })
        } catch (e) {
          setToast({ id: nextId('t'), text: '导出 PNG 失败: ' + String((e && e.message) || e) })
        }
      }
      function openInspector(agent) {
        store.set({ inspectDir: null })
        store.set({ inspectId: agent.id, activeAgentId: agent.id })
      }
      function closeInspector() {
        store.set({ inspectId: null })
      }
      async function rebindAgent(agent) {
        const st0 = store.get()
        if (!st0.workspace) {
          setToast({ id: nextId('t'), text: '请先点「选工作区」' })
          return
        }
        store.set({ agents: st0.agents.map(function (a) { return a.id === agent.id ? merge(a, { pending: true, error: null }) : a }) })
        const suggested = agent.cwd || (st0.workspace + '/' + slugify(firstLine(agent.mission, 24) || 'agent'))
        let r = null
        try {
          r = await createAgent(agent.mission || agent.name, suggested, '', true)
        } catch (e) {
          r = { ok: false, error: String((e && e.message) || e) }
        }
        const cur = store.get()
        const next = cur.agents.map(function (a) {
          if (a.id !== agent.id) return a
          return r && r.ok
            ? merge(a, { sessionId: r.sessionId, cwd: r.cwd || suggested, pending: false, error: null })
            : merge(a, { pending: false, error: (r && r.error) || 'create failed' })
        })
        store.set({ agents: next })
        refresh()
      }
      function updateAgent(id, patch) {
        const cur = store.get()
        store.set({ agents: cur.agents.map(function (a) { return a.id === id ? merge(a, patch) : a }) })
      }
      async function spawnAgentFromSelection() {
        const st0 = store.get()
        const picked = st0.files.filter(function (f) { return st0.fileSel.indexOf(f.path) >= 0 })
        if (picked.length === 0) return
        if (!st0.workspace) {
          setToast({ id: nextId('t'), text: '请先点「选工作区」' })
          return
        }
        const lines = ['负责这些文件（来自画布选择）:']
        for (let i = 0; i < picked.length && i < 40; i++) lines.push('- ' + picked[i].path)
        lines.push('')
        lines.push('只改这些文件，不要动其它文件。')
        const mission = lines.join('\n')
        const id = nextId('agent')
        const idx = st0.agents.length
        const blank = {
          id: id,
          name: firstLine(mission, 16) || ('Agent ' + String(idx + 1)),
          mission: mission,
          sessionId: null,
          cwd: null,
          x: 60 + (idx % 4) * 300,
          y: 70 + Math.floor(idx / 4) * 260,
          color: COLORS[idx % COLORS.length],
          tag: 'create',
          pending: true,
        }
        store.set({ agents: st0.agents.concat([blank]), agentSel: [id], activeAgentId: id })
        const preferred = commonDir(picked.map(function (f) { return f.path }))
        let r = null
        try {
          r = await createAgent(mission, preferred, '', true)
        } catch (e) {
          r = { ok: false, error: String((e && e.message) || e) }
        }
        const cur = store.get()
        const next = cur.agents.map(function (a) {
          if (a.id !== id) return a
          return r && r.ok
            ? merge(a, { sessionId: r.sessionId, cwd: r.cwd || preferred, pending: false, error: null })
            : merge(a, { pending: false, error: (r && r.error) || 'create failed' })
        })
        store.set({ agents: next, fileSel: [] })
        refresh()
      }
      async function openBrowse(rawPath) {
        const p = normalizePath(rawPath)
        if (p.length === 0) return
        setWsBrowse(p)
        setWsBrowseErr(null)
        setWsBrowseItems([])
        let r = null
        try {
          r = await hostCall('canvas-list-files', { path: p, maxDepth: 0, limit: 800 }, 15000)
        } catch (e) {
          r = { ok: false, error: String((e && e.message) || e) }
        }
        if (!r || r.ok !== true) {
          setWsBrowseErr('无法列出 ' + p + '：' + String((r && r.error) || '未知错误'))
          return
        }
        const items = (r.entries || []).filter(function (e) { return e.type === 'directory' })
        items.sort(function (a, b) { return String(a.name).localeCompare(String(b.name)) })
        setWsBrowseItems(items)
      }
      function openWorkspaceForm(errText) {
        const cur = store.get().workspace
        setWsPath(typeof cur === 'string' ? cur : '')
        setWsBusy(false)
        setWsBrowse(null)
        setWsBrowseItems([])
        setWsBrowseErr(null)
        setFormErr(errText ? String(errText) : null)
        store.set({ inspectId: null })
        setForm({ kind: 'workspace' })
        // The in-app browser is the path that always works; show it immediately.
        openBrowse(typeof cur === 'string' && cur ? cur : (store.get().home || '/'))
      }
      function normalizePath(raw) {
        let p = String(raw === undefined || raw === null ? '' : raw).trim()
        if (p.length > 1) {
          const q = p.charAt(0)
          if ((q === '"' || q === "'") && p.charAt(p.length - 1) === q) p = p.slice(1, -1).trim()
        }
        const home = store.get().home
        if (typeof home === 'string' && home.length > 0 && p.indexOf('~/') === 0) {
          p = home.replace(/\/+$/, '') + p.slice(1)
        }
        return p
      }
      async function bindWorkspace(raw) {
        const p = normalizePath(raw)
        if (p.length === 0) {
          setFormErr('请先填写工作区的绝对路径')
          return false
        }
        setWsBusy(true)
        setFormErr(null)
        let r = null
        try {
          r = await hostCall('canvas-stat-dir', { path: p }, 15000)
        } catch (e) {
          r = { ok: false, error: String((e && e.message) || e) }
        }
        setWsBusy(false)
        if (!r || r.ok !== true) {
          setFormErr('无法访问 ' + p + '：' + String((r && r.error) || '未知错误') + '（路径必须已存在）')
          return false
        }
        if (r.isDirectory !== true && r.type !== undefined && r.type !== null && r.type !== 'directory') {
          setFormErr(p + ' 不是一个目录')
          return false
        }
        const resolved = typeof r.path === 'string' && r.path.length > 0 ? r.path : p
        store.set({ workspace: resolved, wsError: null })
        lastScanRoot = null
        lastRefreshSig = null
        setForm(null)
        setFormErr(null)
        setToast({ id: nextId('t'), text: '已绑定工作区：' + resolved })
        refresh()
        return true
      }
      async function tryNativePick() {
        const ui = ctx.get('uiWorkspace')
        if (ui === undefined || typeof ui.pickDirectory !== 'function') {
          setFormErr('当前界面没有提供系统目录选择器，已改用内置目录浏览。')
          openBrowse(wsPath || store.get().home || '/')
          return
        }
        setWsBusy(true)
        setFormErr(null)
        let picked = null
        let errText = null
        try {
          picked = await ui.pickDirectory()
        } catch (e) {
          errText = String((e && e.message) || e)
        }
        setWsBusy(false)
        if (errText !== null) {
          // Some deployments compose only the "browse" picker (no OS chooser), so
          // pickDirectory() is refused. Never dead-end on that: fall back to the
          // in-app directory browser, which is served by this plugin's Host half.
          setFormErr('本机没有系统目录选择器（该部署只提供内置浏览），已自动切换到内置目录浏览。')
          await openBrowse(wsPath || store.get().home || '/')
          return
        }
        if (typeof picked !== 'string' || picked.length === 0) {
          setFormErr('已取消选择。可在下面手动填写绝对路径，或点「浏览目录」。')
          return
        }
        setWsPath(picked)
        await bindWorkspace(picked)
      }
      function openProjectForm() {
        setSessionItems(store.get().sessionList)
        setProjectQuery('')
        setFormErr(null)
        setForm({ kind: 'project' })
      }
      function closeForm() { setForm(null); setFormErr(null) }
      function forceRescan() {
        lastFileScan = 0
        lastScanRoot = null
        lastRefreshSig = null
        refresh()
      }
      function nextFreshCwd(mission) {
        const ws = store.get().workspace
        if (!ws) return null
        return ws + '/' + slugify(firstLine(mission, 24)) + '-' + String(Date.now()).slice(-6)
      }
      function adoptExisting(targetCwd, since) {
        if (!targetCwd) return null
        const list = store.get().sessionList
        for (let i = 0; i < list.length; i++) {
          const s = list[i]
          if (s.cwd !== targetCwd) continue
          if (typeof since === 'number' && typeof s.createdAt === 'number' && s.createdAt < since) continue
          return s.id
        }
        return null
      }
      async function createAgent(mission, cwdInput, preset, ownNode) {
        const typed = String(cwdInput || '').trim()
        const explicit = typed || extractPath(mission)
        const fresh = explicit ? null : nextFreshCwd(mission)
        const target = explicit || fresh
        if (!target) {
          return { ok: false, error: '请先点「选工作区」绑定一个文件夹，新会话需要在它里面建子目录。' }
        }
        const errors = []
        let attemptTimedOut = false
        const attempt = async function (cwd) {
          const r = await hostCall('canvas-create-session', { cwd: cwd, agentPreset: preset || null }, 8000)
          if (r.ok && r.sessionId) return r
          errors.push((cwd ? 'cwd=' + cwd : 'default cwd') + ': ' + (r.error || 'no session id'))
          if (r.timeout) {
            attemptTimedOut = true
            const relist = await hostCall('canvas-sessions', {}, 5000)
            if (relist.ok && relist.items) {
              const sessions = {}
              for (let i = 0; i < relist.items.length; i++) sessions[relist.items[i].id] = relist.items[i]
              store.set({ sessions: sessions, sessionList: relist.items })
              const adopted = adoptExisting(cwd || typed, since)
              if (adopted) {
                errors.pop()
                errors.push('响应超时但会话已创建，已自动认领：' + adopted)
                return { ok: true, sessionId: adopted, adopted: true }
              }
            }
          }
          return null
        }
        const since = Date.now()
        let used = target
        let res = await attempt(target)
        if (!res && target && !attemptTimedOut) {
          used = null
          res = await attempt(null)
        }
        if (!res) return { ok: false, error: '创建会话失败\n' + errors.join('\n') }
        if (used && baselines[used] === undefined && fresh) baselines[used] = {}
        const warning = typed && !used
          ? '指定的工作目录不可用，已回退到默认目录'
          : null
        if (!ownNode) {
          const cur = store.get()
          const id = nextId('agent')
          const idx = cur.agents.length
          const agent = {
            id: id,
            name: firstLine(mission, 16) || ('Agent ' + String(idx + 1)),
            mission: mission,
            sessionId: res.sessionId,
            cwd: used,
            x: 60 + (idx % 4) * 300,
            y: 70 + Math.floor(idx / 4) * 260,
            color: COLORS[idx % COLORS.length],
            tag: 'create',
          }
          store.set({ agents: cur.agents.concat([agent]), agentSel: [id], activeAgentId: id, dock: true })
        }
        return { ok: true, sessionId: res.sessionId, cwd: used, warning: warning }
      }
      async function spawnAgent() {
        const st0 = store.get()
        if (!st0.workspace) {
          setToast({ id: nextId('t'), text: '请先点「选工作区」' })
          return
        }
        const id = nextId('agent')
        const idx = st0.agents.length
        const blank = {
          id: id,
          name: 'Agent ' + String(idx + 1),
          mission: '',
          sessionId: null,
          cwd: null,
          x: 60 + (idx % 4) * 300,
          y: 70 + Math.floor(idx / 4) * 260,
          color: COLORS[idx % COLORS.length],
          tag: 'create',
          pending: true,
        }
        store.set({ agents: st0.agents.concat([blank]), agentSel: [id], activeAgentId: id })
        const mission = 'Agent ' + String(idx + 1)
        try {
          const ws = st0.workspace
          const suggested = ws + '/' + slugify('agent-' + String(idx + 1))
          const r = await createAgent(mission, suggested, '', true)
          const cur = store.get()
          if (r && r.ok) {
            const next = cur.agents.map(function (a) {
              return a.id === id ? merge(a, { sessionId: r.sessionId, cwd: r.cwd || suggested, pending: false, error: null }) : a
            })
            store.set({ agents: next })
            if (r.warning) setToast({ id: nextId('t'), text: r.warning })
          } else {
            const next = cur.agents.map(function (a) {
              return a.id === id ? merge(a, { pending: false, error: (r && r.error) || 'create failed' }) : a
            })
            store.set({ agents: next })
          }
        } catch (e) {
          const cur2 = store.get()
          const next2 = cur2.agents.map(function (a) {
            return a.id === id ? merge(a, { pending: false, error: '异常：' + String((e && e.message) || e) }) : a
          })
          store.set({ agents: next2 })
        }
        refresh()
      }
      function projectSession(s) {
        const cur = store.get()
        const id = nextId('agent')
        const idx = cur.agents.length
        const agent = {
          id: id,
          name: s.title ? firstLine(s.title, 16) : (s.cwd ? firstLine(s.cwd, 16) : 'session'),
          mission: '',
          sessionId: s.id,
          cwd: s.cwd || null,
          x: 60 + (idx % 4) * 300,
          y: 70 + Math.floor(idx / 4) * 260,
          color: COLORS[idx % COLORS.length],
          tag: 'project',
        }
        store.set({ agents: cur.agents.concat([agent]), agentSel: [id], activeAgentId: id, dock: true })
        setForm(null)
        refresh()
      }
      function agentInfoRows(a) {
        const mine = st.files.filter(function (f) { return f.agentId === a.id })
        const fresh = mine.filter(function (f) { return f.isNew })
        const sess = st.sessions[a.sessionId] || null
        const shown = mine.slice(0, 8)
        return [
          h('div', { key: 'mission', className: 'acx-sm' }, a.mission ? ('使命: ' + firstLine(a.mission, 80)) : '使命: (未设置)'),
          h('div', { key: 'scope', className: 'acx-hsect' },
            h('div', { className: 'acx-hlab' }, '掌管的上下文范围'),
            h('div', { className: 'acx-mono' }, a.cwd || '(工作目录未知)'),
            h('div', { className: 'acx-sm' }, '画布文件节点 ' + String(mine.length) + ' 个，其中本会话新建 ' + String(fresh.length) + ' 个'),
            mine.length > 0 ? h('div', { className: 'acx-flist' }, shown.map(function (f) {
              return h('div', { key: f.path, className: 'acx-frow' },
                h('span', { className: f.isNew ? 'acx-ok' : '' }, f.isNew ? 'new' : '   '),
                h('span', { style: { color: 'var(--dsw-alias-label-secondary,inherit)' } }, f.rel || f.name),
              )
            })) : h('div', { className: 'acx-sm' }, '还没有文件；agent 创建文件后会自动出现在画布上'),
          ),
          h('div', { key: 'sess', className: 'acx-hsect' },
            h('div', { className: 'acx-hlab' }, 'DSH 会话（投影）'),
            h('div', { className: 'acx-mono' }, a.sessionId || '(无)'),
            h('div', { className: 'acx-sm' }, (sess && sess.live ? 'live' : 'cold') + ' · 选中即可聊天'),
            a.missing ? h('div', { className: 'acx-sm acx-warn' }, '会话未在列表中（可能已归档），发送可能失败') : null,
          ),
        ]
      }
      function fileInfoRows(f) {
        const owner = findAgent(st.agents, f.agentId)
        return [
          h('div', { key: 'path', className: 'acx-mono' }, f.path),
          h('div', { key: 'meta', className: 'acx-sm' }, (f.type === 'directory' ? '目录' : '文件') + (f.size !== null && f.type !== 'directory' ? ' · ' + fmtSize(f.size) : '')),
          h('div', { key: 'owner', className: 'acx-hsect' },
            h('div', { className: 'acx-hlab' }, '归属 agent'),
            h('div', null, owner ? owner.name : '(未归属)'),
            f.isNew ? h('div', { className: 'acx-ok' }, '画布开始监视后新出现（很可能是 agent 创建的）') : null,
            h('div', { className: 'acx-sm' }, '单击选中，选中后可基于它创建新 agent'),
          ),
        ]
      }
      const pickedFiles = st.files.filter(function (f) { return st.fileSel.indexOf(f.path) >= 0 })
      const bar = h('div', { className: 'acx-bar' },
        h('b', null, 'Agent Canvas'),
        h('button', {
          className: st.dock ? 'acx-btn acx-primary' : 'acx-btn',
          onClick: function () { store.set({ dock: !store.get().dock }) },
        }, st.dock ? '会话 开' : '会话'),
        h('button', {
          className: st.workspace ? 'acx-btn' : 'acx-btn acx-primary',
          onClick: function () { openWorkspaceForm(null) },
        }, st.workspace ? '工作区: ' + basename(st.workspace) : '绑定工作区'),
        h('button', {
          className: st.mode === 'file' ? 'acx-btn acx-primary' : 'acx-btn',
          onClick: function () { store.set({ mode: 'file' }) },
        }, '移动文件'),
        h('button', {
          className: st.mode === 'agent' ? 'acx-btn acx-primary' : 'acx-btn',
          onClick: function () { store.set({ mode: 'agent' }) },
        }, '移动 Agent'),
        h('button', { className: 'acx-btn acx-primary', onClick: spawnAgent }, '+ Agent'),
        h('button', {
          className: 'acx-btn',
          disabled: pickedFiles.length === 0,
          onClick: spawnAgentFromSelection,
        }, pickedFiles.length > 0 ? ('基于选中 ' + String(pickedFiles.length) + ' 个文件建 Agent') : '基于选中文件建 Agent'),
        h('button', {
          className: multiMode ? 'acx-btn acx-primary' : 'acx-btn',
          onClick: function () { setMultiMode(!multiMode) },
        }, multiMode ? '多选 开' : '多选 关'),
        h('button', { className: 'acx-btn', title: '折叠/展开左侧栏，给画布让出宽度', onClick: toggleLeftSidebar }, '左栏'),
        h('button', { className: 'acx-btn', onClick: openProjectForm }, '投影会话'),
        h('button', { className: 'acx-btn', onClick: exportPng }, '导出 PNG'),
        h('button', { className: 'acx-btn', onClick: exportJson }, '导出 JSON'),
        h('button', { className: 'acx-btn', onClick: exportMarkdown }, '导出 MD'),
        h('button', { className: 'acx-btn', onClick: exportMarkdownToWorkspace }, '写入工作区'),
        h('span', { className: 'acx-spacer' }),
        h('button', { className: 'acx-btn', title: '缩小', onClick: function () { zoomStep(0.8) } }, '\u2212'),
        h('button', { className: 'acx-btn', title: '当前缩放（点击回到 100%）', onClick: function () { zoomTo(1, (canvasRef.current && canvasRef.current.clientWidth ? canvasRef.current.clientWidth : 800) / 2, (canvasRef.current && canvasRef.current.clientHeight ? canvasRef.current.clientHeight : 600) / 2) } }, Math.round(zoom * 100) + '%'),
        h('button', { className: 'acx-btn', title: '放大', onClick: function () { zoomStep(1.25) } }, '+'),
        h('button', { className: 'acx-btn', title: '显示全部节点', onClick: fitToContent }, '\u9002\u5e94'),
        h('button', {
          className: showPerf ? 'acx-btn acx-primary' : 'acx-btn',
          title: '性能监测：每帧耗时 / FPS / Host 往返 / 由拖动触发的重渲染',
          onClick: function () {
            const next = !showPerf
            if (next) { PERF.drawMax = 0; PERF.hostMs = 0; PERF.hostCalls = 0; PERF.hostTotalMs = 0; PERF.moves = 0; PERF.moveRenders = 0 }
            setShowPerf(next)
          },
        }, showPerf ? '\u6027\u80fd \u5f00' : '\u6027\u80fd'),
        h('button', { className: 'acx-btn', onClick: function () {
          for (const k in manual) delete manual[k]
          bumpManual()
        } }, '重排'),
        h('button', { className: 'acx-btn', onClick: function () { setPan({ x: 36, y: 30 }) } }, '复位'),
        h('button', { className: 'acx-btn', onClick: forceRescan }, '重扫'),
        h('button', { className: 'acx-btn acx-danger', onClick: function () {
          clearCache()
          for (const k in manual) delete manual[k]
          store.set({ agents: [], agentSel: [], activeAgentId: null, workspace: null, fileSel: [], files: [], wsError: null, inspectDir: null, manualVersion: (store.get().manualVersion || 0) + 1 })
          refresh()
        } }, '清空画布'),
      )
      let formEl = null
      let settingsPanel = null
      let dirPanel = null
      const inspectAgent = st.inspectId ? findAgent(st.agents, st.inspectId) : null
      if (form && form.kind === 'workspace') {
        const curWs = st.workspace
        const browseDirs = wsBrowseItems.filter(function (e) { return e.type === 'directory' })
        formEl = h('div', { className: 'acx-form' },
          h('div', { className: 'acx-form-title' }, '绑定工作区文件夹'),
          h('div', { className: 'acx-hint' }, '一个 canvas 对应一个工作区文件夹。用下面的「浏览目录」在应用内选一个，或直接填写绝对路径后点「绑定」；Host 会先校验该路径是否存在且为目录。'),
          h('div', { className: 'acx-row' },
            h('input', {
              className: 'acx-inp',
              style: { flex: '1 1 260px', minWidth: '180px' },
              value: wsPath,
              placeholder: st.home ? (st.home + '/project') : '/绝对/路径',
              onChange: function (e) { setWsPath(e.target.value) },
              onKeyDown: function (e) { if (e.key === 'Enter') { e.preventDefault(); bindWorkspace(wsPath) } },
            }),
          ),
          h('div', { className: 'acx-row' },
            h('button', { className: 'acx-btn acx-primary', disabled: wsBusy, onClick: function () { bindWorkspace(wsPath) } }, wsBusy ? '校验中…' : '绑定'),
            h('button', { className: 'acx-btn', disabled: wsBusy, onClick: function () { openBrowse(wsPath || st.home || '/') } }, '浏览目录'),
            h('button', { className: 'acx-btn', disabled: wsBusy, onClick: tryNativePick }, '系统选择器（可选）'),
            st.home ? h('button', { className: 'acx-btn', disabled: wsBusy, onClick: function () { setWsPath(st.home) } }, '主目录') : null,
            curWs ? h('button', { className: 'acx-btn', disabled: wsBusy, onClick: function () { setWsPath(curWs) } }, '当前工作区') : null,
          ),
          curWs ? h('div', { className: 'acx-hint' }, '当前已绑定：' + curWs) : null,
          wsBrowse !== null ? h('div', null,
            h('div', { className: 'acx-row' },
              h('span', { className: 'acx-mono' }, wsBrowse),
              h('span', { className: 'acx-spacer' }),
              h('button', { className: 'acx-btn', onClick: function () { setWsPath(wsBrowse); setWsBrowse(null); setWsBrowseErr(null) } }, '用这个目录'),
              wsBrowse !== '/' ? h('button', { className: 'acx-btn', onClick: function () { openBrowse(dirname(wsBrowse)) } }, '上一层') : null,
              h('button', { className: 'acx-btn', onClick: function () { setWsBrowse(null); setWsBrowseErr(null) } }, '收起'),
            ),
            wsBrowseErr ? h('div', { className: 'acx-errbox' }, wsBrowseErr) : null,
            h('div', { className: 'acx-slist' },
              browseDirs.length === 0
                ? h('div', { className: 'acx-empty' }, '(没有子目录)')
                : browseDirs.map(function (e) {
                    return h('div', { key: e.path, className: 'acx-srow', onClick: function () { openBrowse(e.path) } },
                      h('div', { className: 'acx-st' }, '[D] ' + e.name),
                    )
                  }),
            ),
          ) : null,
          formErr ? h('div', { className: 'acx-errbox' }, formErr) : null,
          h('div', { className: 'acx-btns' },
            h('button', { className: 'acx-btn', onClick: closeForm }, '关闭'),
          ),
        )
      }
      // 右侧设置：选中 agent 后，它的全部设置都在右栏，而不是底部弹层。
      if (inspectAgent) {
        const options = [h('option', { key: '__default', value: '' }, '默认 preset')]
        for (let i = 0; i < presets.length; i++) options.push(h('option', { key: presets[i].id, value: presets[i].id }, presets[i].name))
        const sess = st.sessions[inspectAgent.sessionId] || null
        settingsPanel = h('div', { className: 'acx-side' },
          h('div', { className: 'acx-sheet-head' },
            h('b', null, 'Agent 设置'),
            h('span', { className: 'acx-sm' }, inspectAgent.name),
            h('button', { className: 'acx-btn', onClick: closeInspector }, '收起'),
          ),
          inspectAgent.pending ? h('div', { className: 'acx-hint' }, '正在创建会话…') : null,
          inspectAgent.error ? h('div', { className: 'acx-errbox' }, inspectAgent.error) : null,
          h('div', { className: 'acx-row' },
            h('span', { className: 'acx-sm' }, '名称'),
            h('input', {
              className: 'acx-inp',
              value: inspectAgent.name,
              onChange: function (e) { updateAgent(inspectAgent.id, { name: e.target.value }) },
            }),
          ),
          h('div', { className: 'acx-row' },
            h('span', { className: 'acx-sm' }, '使命 prompt'),
          ),
          h('textarea', {
            className: 'acx-ta',
            value: inspectAgent.mission || '',
            placeholder: '例如：在工作区内写一个 hello.py 并运行它',
            onChange: function (e) { updateAgent(inspectAgent.id, { mission: e.target.value }) },
          }),
          h('div', { className: 'acx-row' },
            h('span', { className: 'acx-sm' }, 'Agent preset'),
            h('select', { className: 'acx-sel', value: '', onChange: function (e) { if (e.target.value) rebindAgent(merge(inspectAgent, { preset: e.target.value })) } }, options),
          ),
          h('div', { className: 'acx-hsect' },
            h('div', { className: 'acx-hlab' }, '会话（作为 DSH 会话的投影）'),
            h('div', { className: 'acx-mono' }, inspectAgent.sessionId || '(尚未创建)'),
            inspectAgent.cwd ? h('div', { className: 'acx-mono' }, inspectAgent.cwd) : null,
            h('div', { className: 'acx-sm' }, sess && sess.live ? 'live' : 'cold'),
          ),
          h('div', { className: 'acx-btns' },
            h('button', { className: 'acx-btn', onClick: function () {
              const err = openInSidebar(inspectAgent.sessionId)
              if (err) setToast({ id: nextId('t'), text: err })
            } }, '在左侧打开'),
            h('button', { className: 'acx-btn', onClick: function () { rebindAgent(inspectAgent) } }, inspectAgent.sessionId ? '重建会话' : '创建会话'),
            h('button', { className: 'acx-btn', onClick: function () { forkAgent(inspectAgent) } }, '分身 Fork'),
            h('span', { className: 'acx-spacer' }),
            h('button', { className: 'acx-btn acx-danger', onClick: function () { removeAgent(inspectAgent.id); closeInspector() } }, '移除'),
            h('button', { className: 'acx-btn acx-primary', onClick: closeInspector }, '完成'),
          ),
        )
      }
      const inspectDirFile = st.inspectDir ? (fileByPath[st.inspectDir] || null) : null
      if (inspectDirFile !== null) {
        const kids = dirEntries(inspectDirFile.path)
        let doneCount = 0
        for (let i = 0; i < kids.length; i++) {
          const k = kids[i]
          if (k.type === 'directory' ? revealed[k.path] === true : manual[k.path] !== undefined) doneCount += 1
        }
        // Split ONE child at a time: list both subfolders and files of this node.
        dirPanel = h('div', { className: 'acx-side' },
          h('div', { className: 'acx-sheet-head' },
            h('b', null, '分裂'),
            h('span', { className: 'acx-sm' }, inspectDirFile.name),
            h('button', { className: 'acx-btn', onClick: function () { store.set({ inspectDir: null }) } }, '收起'),
          ),
          h('div', { className: 'acx-mono' }, inspectDirFile.path),
          h('div', { className: 'acx-sm' },
            '共 ' + String(kids.length) + ' 项（子文件夹 ' + String(kids.filter(function (k) { return k.type === 'directory' }).length) + ' / 文件 ' + String(kids.filter(function (k) { return k.type !== 'directory' }).length) + '），已分裂 ' + String(doneCount) + ' 项。每次只分裂一个。'),
          h('div', null, kids.map(function (k) {
            const isDir = k.type === 'directory'
            const done = isDir ? revealed[k.path] === true : manual[k.path] !== undefined
            return h('div', { key: k.path, style: { display: 'flex', alignItems: 'center', gap: '6px', padding: '2px 0' } },
              h('span', { className: 'acx-mono', style: { flex: '1 1 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, (isDir ? '\uD83D\uDCC1 ' : '\uD83D\uDCC4 ') + k.name),
              h('button', {
                className: done ? 'acx-btn' : 'acx-btn acx-primary',
                disabled: done,
                onClick: function () { splitChild(inspectDirFile.path, k.path, isDir) },
              }, done ? '已分裂' : '分裂'),
            )
          })),
          h('div', { className: 'acx-btns' },
            h('button', {
              className: 'acx-btn',
              disabled: doneCount === 0,
              onClick: function () { unsplitDir(inspectDirFile.path) },
            }, '全部收回'),
          ),
        )
      }
      if (form && form.kind === 'project') {
        const source = sessionItems.length > 0 ? sessionItems : st.sessionList
        const needle = projectQuery.trim().toLowerCase()
        const filtered = source.filter(function (s) {
          if (!needle) return true
          return (String(s.title || '') + ' ' + String(s.cwd || '') + ' ' + String(s.id) + ' ' + String(s.origin || '')).toLowerCase().indexOf(needle) >= 0
        })
        formEl = h('div', { className: 'acx-form' },
          h('div', { className: 'acx-form-title' }, '投影一个已有会话（左侧栏 session 的投影）'),
          h('div', { className: 'acx-hint' }, '列表直接可点选。被投影的 agent 与左侧栏是同一个会话：在这里发消息，左侧栏也能看到；它的工作目录下的文件也会显示在画布上。'),
          h('div', { className: 'acx-row' },
            h('input', {
              className: 'acx-inp',
              value: projectQuery,
              placeholder: '过滤 title / cwd / id',
              onChange: function (e) { setProjectQuery(e.target.value) },
            }),
            h('button', { className: 'acx-btn', onClick: function () {
              hostCall('canvas-sessions', { titles: true, titleLimit: 20 }, 30000).then(function (r) {
                if (r.ok) { setSessionItems(r.items || []); setFormErr(null) }
                else setFormErr(r.error || 'list failed')
              })
            } }, '刷新'),
            h('span', { className: 'acx-sm' }, String(filtered.length) + ' / ' + String(source.length)),
          ),
          formErr ? h('div', { className: 'acx-errbox' }, formErr) : null,
          h('div', { className: 'acx-slist' },
            filtered.length === 0
              ? h('div', { className: 'acx-empty' }, '没有匹配的会话')
              : filtered.slice(0, 300).map(function (s) {
                  return h('div', { key: s.id, className: 'acx-srow', onClick: function () { projectSession(s) } },
                    h('div', { className: 'acx-st' }, (s.title || '(未命名会话)') + (s.live ? ' · live' : '')),
                    h('div', { className: 'acx-sm' }, s.id + (s.cwd ? ' · ' + s.cwd : '') + (s.origin ? ' · ' + s.origin : '')),
                  )
                }),
          ),
          h('div', { className: 'acx-btns' },
            h('span', { className: 'acx-spacer' }),
            h('button', { className: 'acx-btn', onClick: closeForm }, '关闭'),
          ),
        )
      }
      const hoveredAgent = hoverAgentId ? findAgent(st.agents, hoverAgentId) : null
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
              '先点「绑定工作区」绑定一个文件夹，再用「+ Agent」创建会话。每个 agent 在该工作区内拥有自己的子目录，它创建的每个文件都会作为节点出现。')
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
              h('button', { className: 'acx-btn', onClick: function () { setInfo(null) } }, '关闭'),
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
              h('button', { className: 'acx-btn', onClick: function () { setInfo(null) } }, '关闭'),
            ),
            fileInfoRows(f),
          )
        }
      }
      const perfPanel = !showPerf ? null : h('div', { className: 'acx-perf' },
        h('div', { className: 'acx-perf-h' }, '\u6027\u80fd\u76d1\u6d4b'),
        h('div', null, '\u5e27\u7ed8\u5236: ' + String(PERF.drawMs) + ' ms  (\u5cf0\u503c ' + String(PERF.drawMax) + ' ms)'),
        h('div', null, 'FPS: ' + (PERF.fps > 0 ? String(PERF.fps) : '\u2014') + '  \u00b7  \u672c\u5e27\u8282\u70b9: ' + String(PERF.drawn) + ' / ' + String(st.files.length)),
        h('div', null, '\u62d6\u52a8\u4e8b\u4ef6: ' + String(PERF.moves) + '  \u00b7  \u89e6\u53d1\u91cd\u6e32\u67d3: ' + String(PERF.moveRenders) + ' (\u76ee\u6807 0)'),
        h('div', null, 'Host \u6700\u6162: ' + String(Math.round(PERF.hostMs)) + ' ms' + (PERF.hostMethod ? ' (' + PERF.hostMethod + ')' : '') + '  \u00b7  ' + String(PERF.hostCalls) + ' \u6b21/\u7d2f\u8ba1 ' + String(Math.round(PERF.hostTotalMs)) + ' ms'),
        h('div', { className: 'acx-perf-n' }, '\u62d6\u52a8/\u7f29\u653e\u4e0d\u5e94\u8be5\u89e6\u53d1 React \u91cd\u6e32\u67d3\uff1b\u82e5\u89e6\u53d1\u5219\u5361\u5728\u91cd\u6e32\u67d3\u800c\u975e canvas\u3002'),
      )
      const legend = h('div', { className: 'acx-legend' },
        h('span', null, st.workspace ? basename(st.workspace) : '(未选工作区)'),
        h('span', null, 'agent ' + String(st.agents.length) + ' · 文件 ' + String(st.files.length) + (lastDrawCount > 0 ? ' · 当帧绘制 ' + String(lastDrawCount) : '')),
        st.scanNote ? h('span', null, st.scanNote) : null,
        st.wsError ? h('span', { style: { color: 'var(--dsw-alias-label-error, #d4380d)' } }, String(st.wsError)) : null,
      )
      return h('div', { ref: rootRef, className: touchMode ? 'acx-root acx-touch' : 'acx-root' },
        h('div', { className: 'acx-canvas' }),
        graph,
        layers,
        bar,
        legend,
        perfPanel,
        (dirPanel !== null || settingsPanel !== null || st.dock) ? h('div', { className: 'acx-right' }, dirPanel, settingsPanel, st.dock ? h(ChatDock, { touch: touchMode }) : null) : null,
        formEl,
        infoSheet,
        toast ? h('div', { className: 'acx-toast' }, toast.text) : null,
      )
    }
    function RunCard() {
      const st = useStore()
      const m1 = React.useState('')
      const msg = m1[0]
      const setMsg = m1[1]
      function openPanel() {
        const layout = ctx.get('layout')
        if (layout === undefined || typeof layout.selectPanel !== 'function') {
          setMsg('layout 服务不可用：请点左侧栏的 Agent Canvas 图标')
          return
        }
        try {
          layout.selectPanel(PANEL_ID)
          setMsg('已切换到 Agent Canvas')
        } catch (e) {
          setMsg('切换失败: ' + String((e && e.message) || e))
        }
      }
      return h('div', { className: 'acx-inline' },
        h('div', { style: { fontWeight: 600 } }, 'Agent Canvas · 图工作台'),
        h('div', { className: 'acx-sm' }, 'agent ' + String(st.agents.length) + ' · 文件节点 ' + String(st.files.length) + ' · 已选 agent ' + String(st.agentSel.length) + ' · 已选文件 ' + String(st.fileSel.length)),
        h('div', { style: { display: 'flex', gap: '7px', flexWrap: 'wrap' } },
          h('button', { className: 'acx-btn acx-primary', onClick: openPanel }, '打开画布 Screen'),
        ),
        msg ? h('div', { className: 'acx-sm' }, msg) : null,
      )
    }
    const slots = ctx.get('slots')
    if (slots === undefined) {
      console.error('[agent-canvas] slots service unavailable; UI not registered')
      return
    }
    ctx.effect(function () { return styles.insert(CSS) })
    slots.inject('main', function () {
      return slots.register({ name: 'main', key: PANEL_ID }, function () { return h(CanvasApp, null) })
    })
    slots.inject('sidebar.panellist', function () {
      return slots.register({ name: 'sidebar.panellist', id: PANEL_ID, order: 3, label: 'Agent Canvas' }, function (props) {
        return h(CanvasIcon, { size: (props && props.size) || 18, active: !!(props && props.active) })
      })
    })
    slots.inject('tool.view.cordis', function () {
      return slots.register({ name: 'tool.view.cordis', key: 'self' }, function () { return h(RunCard, null) })
    })
    console.log('[agent-canvas] client apply pkg-24: panel "' + PANEL_ID + '" registered, ws=' + String(store.get().workspace) + ' touch=' + String(detectTouch()))
  },
}
