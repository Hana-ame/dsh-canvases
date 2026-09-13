const h = React.createElement
const PANEL_ID = 'agent-canvas'
const AGENT_SIZE = 56
const FILE_W = 200
const FILE_H = 44
const ROW_PER_COL = 6
const CONTENT_W = 4200
const CONTENT_H = 3200
const FONT_STACK = 'ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif'
let lastDrawCount = 0
const COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']
const CSS = [
  '.acx-root{position:relative;flex:1 1 auto;height:100%;min-height:0;width:100%;overflow:hidden;background:var(--dsw-alias-bg-base,transparent);color:var(--dsw-alias-label-primary,inherit);font-size:13px;line-height:1.45}',
  '.acx-canvas{position:absolute;inset:0;z-index:0;pointer-events:none;background-color:var(--dsw-alias-bg-base,transparent);background-image:radial-gradient(var(--dsw-alias-border-l1,rgba(127,127,127,.35)) 1px,transparent 1px);background-size:22px 22px}',
  '.acx-graph{position:absolute;inset:0;z-index:1;display:block;width:100%;height:100%;touch-action:none;cursor:grab}',
  '.acx-graph[data-panning=1]{cursor:grabbing}',
  '.acx-layer{position:absolute;inset:0;z-index:2;pointer-events:none}',
  '.acx-edges{position:absolute;left:0;top:0;pointer-events:none;overflow:visible}',
  '.acx-bar{position:absolute;top:8px;left:8px;right:8px;z-index:30;display:flex;align-items:center;gap:6px;padding:6px;border:1px solid var(--dsw-alias-border-l3,rgba(127,127,127,.35));border-radius:12px;background:var(--dsw-alias-button-floating-fill,var(--dsw-alias-bg-overlay,transparent));backdrop-filter:blur(12px);flex-wrap:wrap;row-gap:6px;max-height:40%;overflow-x:hidden;overflow-y:auto}',
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
  '.acx-dock{position:absolute;top:96px;right:8px;bottom:8px;z-index:16;width:min(376px,46%);display:flex;flex-direction:column;min-height:0;border:1px solid var(--dsw-alias-border-l3,rgba(127,127,127,.35));border-radius:14px;background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-layer-2,transparent));box-shadow:0 12px 32px rgba(0,0,0,.28);overflow:hidden}',
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
  '.acx-touch .acx-hover{display:none}',
  '.acx-touch .acx-form{max-height:48%}',
  '@media (max-width: 760px){',
  '.acx-dock{top:auto;left:8px;right:8px;bottom:8px;width:auto;height:min(52%,360px)}',
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
    setTimeout(function () { URL.revokeObjectURL(url) }, 4000)
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
    })
    const baselines = {}
    const manual = {}
    for (const k in cachedPositions) {
      const v = cachedPositions[k]
      if (v && typeof v.x === "number" && typeof v.y === "number") manual[k] = { x: v.x, y: v.y }
    }
    let persistTimer = null
    function persist() {
      const s = store.get()
      const positions = {}
      for (const k in manual) positions[k] = { x: manual[k].x, y: manual[k].y }
      const agents = s.agents.map(function (a) {
        return { id: a.id, name: a.name, mission: a.mission, sessionId: a.sessionId, cwd: a.cwd, x: a.x, y: a.y, color: a.color, tag: a.tag }
      })
      saveCache({ version: 1, workspace: s.workspace, dock: s.dock, mode: s.mode, agents: agents, positions: positions, savedAt: Date.now() })
    }
    function persistSoon() {
      if (persistTimer !== null) return
      const timer = ctx.get("timer")
      if (timer === undefined || typeof timer.timeout !== "function") { persist(); return }
      persistTimer = timer.timeout(function () { persistTimer = null; persist() }, 800)
    }
    store.subscribe(persistSoon)
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
      const call = Promise.resolve()
        .then(function () { return host.call(method, args) })
        .then(function (r) {
          return r === undefined || r === null ? { ok: false, error: 'empty response' } : r
        }, function (e) {
          return { ok: false, error: String((e && e.message) || e) }
        })
      if (!timeoutMs || timeoutMs <= 0) return call
      const timer = ctx.get('timer')
      if (timer === undefined || typeof timer.timeout !== 'function') return call
      const deadline = timer.timeout(timeoutMs).then(function () {
        return { ok: false, error: '\u8d85\u65f6 ' + String(timeoutMs) + 'ms\uff1aHost \u6ca1\u6709\u54cd\u5e94', timeout: true }
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
    const FILE_SCAN_MS = 6000
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
      const dueScan = ws !== lastScanRoot || (now - lastFileScan) > FILE_SCAN_MS
      if (ws && dueScan) {
        const r = await hostCall('canvas-list-files', { path: ws, maxDepth: 8, limit: 4000 }, 20000)
        if (!r.ok) {
          note = '\u626b\u63cf ' + ws + ' \u5931\u8d25: ' + (r.error || '')
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
            files.push({
              path: e.path,
              name: e.name,
              rel: e.rel,
              type: e.type,
              size: e.size,
              agentId: assignOwner(agents, e.path),
              root: ws,
              isNew: baselines[ws][e.path] !== true,
            })
          }
          if (r.truncated) note = ws + ' \u5185\u5bb9\u8fc7\u591a\uff0c\u4ec5\u663e\u793a\u524d 4000 \u9879'
          lastFileScan = now
          lastScanRoot = ws
        }
      } else if (ws) {
        for (let i = 0; i < cur.files.length; i++) {
          const f = cur.files[i]
          files.push(merge(f, { agentId: assignOwner(agents, f.path) }))
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
    function filePos(agent, index, file) {
      const m = manual[file.path]
      if (m) return m
      const col = Math.floor(index / ROW_PER_COL)
      const row = index % ROW_PER_COL
      return { x: agent.x + 150 + col * (FILE_W + 12), y: agent.y - 30 + row * (FILE_H + 8) }
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
        h('span', null, '\u4f1a\u8bdd\u6295\u5f71'),
        h('span', { className: 'acx-spacer' }),
        h('span', { className: 'acx-sm' }, targets.length === 0 ? '\u672a\u9009\u62e9 agent' : (targets.length === 1 ? '\u5355\u804a' : '\u7fa4\u53d1 ' + String(targets.length))),
        h('button', { className: 'acx-mini', onClick: function () { store.set({ dock: false }) } }, '\u6536\u8d77'),
      )
      const chips = h('div', { className: 'acx-chips' },
        targets.length === 0
          ? h('span', { className: 'acx-sm' }, '\u70b9\u51fb agent \u9009\u4e2d\uff1b\u5f00\u300c\u591a\u9009\u300d\u6216\u7528 Ctrl/Cmd/Shift \u53ef\u591a\u9009\u3002\u60ac\u505c\u6216\u70b9\u5f00 agent \u53ef\u770b\u5b83\u638c\u7ba1\u7684\u4e0a\u4e0b\u6587\u8303\u56f4\u3002')
          : targets.map(function (a) {
              return h('span', { key: a.id, className: 'acx-chip' },
                h('span', { style: { color: a.color } }, '*'),
                h('span', null, a.name),
                h('button', { className: 'acx-mini', onClick: function () { toggleAgent(a.id) } }, 'x'),
              )
            }),
        h('span', { className: 'acx-spacer' }),
        h('button', { className: 'acx-mini', onClick: function () { store.set({ agentSel: store.get().agents.map(function (a) { return a.id }) }) } }, '\u5168\u9009'),
        h('button', { className: 'acx-mini', onClick: function () { store.set({ agentSel: [] }) } }, '\u6e05\u7a7a'),
      )
      let body = null
      if (targets.length === 0) {
        body = h('div', { className: 'acx-empty' }, '\u9009\u62e9\u4e00\u4e2a\u6216\u591a\u4e2a agent \u5f00\u59cb\u804a\u5929\u3002\u804a\u5929\u76f4\u63a5\u6295\u5f71\u81ea DSH \u4f1a\u8bdd\uff0c\u5de6\u4fa7\u680f\u4f1a\u540c\u6b65\u663e\u793a\u3002')
      } else if (single) {
        const mine = st.files.filter(function (f) { return f.agentId === single.id })
        body = h('div', { className: 'acx-log', ref: scrollRef },
          h('div', { className: 'acx-row' },
            h('span', { className: 'acx-sm' }, 'session: ' + (single.sessionId || '\u65e0')),
            h('span', { className: 'acx-spacer' }),
            transcript.source === 'poll' ? h('span', { className: 'acx-sm' }, '\u8f6e\u8be2\u6a21\u5f0f') : null,
            transcript.running ? h('span', { className: 'acx-sm acx-ok' }, '\u8fd0\u884c\u4e2d') : null,
          ),
          h('div', { className: 'acx-sm' }, '\u5de5\u4f5c\u76ee\u5f55: ' + (single.cwd || '\u672a\u77e5') + ' \u00b7 \u753b\u5e03\u4e0a ' + String(mine.length) + ' \u4e2a\u6587\u4ef6\u8282\u70b9'),
          transcript.error ? h('div', { className: 'acx-errbox' }, transcript.error) : null,
          msgs.length === 0 ? h('div', { className: 'acx-sm' }, '(\u6682\u65e0\u6d88\u606f)') : null,
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
          h('div', { className: 'acx-hint' }, '\u7fa4\u53d1\u6a21\u5f0f\uff1a\u540c\u4e00\u6761 prompt \u53d1\u7ed9\u4e0b\u5217 ' + String(targets.length) + ' \u4e2a agent\uff0c\u5404\u81ea\u5e26\u4e0a\u81ea\u5df1\u7684\u5de5\u4f5c\u76ee\u5f55\u4e0e\u4f7f\u547d\u3002'),
          targets.map(function (a) {
            return h('div', { key: a.id, className: 'acx-srow', onClick: function () { store.set({ agentSel: [a.id], activeAgentId: a.id }) } },
              h('div', { className: 'acx-st' }, h('span', { style: { color: a.color } }, '* '), a.name),
              h('div', { className: 'acx-sm' }, 'cwd: ' + (a.cwd || '\u672a\u77e5')),
              h('div', { className: 'acx-sm' }, 'session: ' + (a.sessionId || '\u65e0')),
            )
          }),
        )
      }
      const foot = h('div', { className: 'acx-compose' },
        pickedFiles.length > 0 ? h('div', { className: 'acx-sm acx-warn' }, '\u5df2\u9009 ' + String(pickedFiles.length) + ' \u4e2a\u6587\u4ef6\u4f1a\u968f\u6d88\u606f\u4e00\u8d77\u53d1\u7ed9\u6bcf\u4e2a agent') : null,
        h('div', { className: 'acx-row' },
          h('select', { className: 'acx-sel', value: mode, onChange: function (e) { setMode(e.target.value) } },
            h('option', { value: 'queue' }, '\u6392\u961f queue'),
            h('option', { value: 'steer' }, '\u63d2\u8bdd steer'),
          ),
          h('span', { className: 'acx-sm' }, busy ? '\u53d1\u9001\u4e2d...' : (touchInput ? '\u70b9\u53d1\u9001\u6309\u94ae' : 'Enter \u53d1\u9001')),
          h('span', { className: 'acx-spacer' }),
          h('button', {
            className: 'acx-btn acx-primary',
            disabled: busy || !text.trim() || targets.length === 0,
            onClick: doSend,
          }, targets.length > 1 ? ('\u7fa4\u53d1\u7ed9 ' + String(targets.length) + ' \u4e2a') : '\u53d1\u9001'),
        ),
        h('textarea', {
          className: 'acx-ta',
          style: { minHeight: '62px' },
          value: text,
          placeholder: '\u8f93\u5165 prompt...',
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
          } }, '\u5728\u5de6\u4fa7\u6253\u5f00'),
          h('button', { className: 'acx-btn', onClick: function () { forkAgent(single) } }, '\u5206\u8eab Fork'),
          h('span', { className: 'acx-spacer' }),
          h('button', { className: 'acx-btn acx-danger', onClick: function () { removeAgent(single.id) } }, '\u79fb\u9664'),
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
      const wsBrowseErr = wsb4[0]
      const setWsBrowseErr = wsb4[1]
      const canvasRef = React.useRef(null)
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
      const filePosIndex = {}
      const fileByPath = {}
      const agentFileCount = {}
      const agentsById = {}
      for (let i = 0; i < st.agents.length; i++) agentsById[st.agents[i].id] = st.agents[i]
      const ownerSeen = {}
      for (let i = 0; i < st.files.length; i++) {
        const f = st.files[i]
        fileByPath[f.path] = f
        const key = f.agentId === null || f.agentId === undefined ? '' : String(f.agentId)
        const seen = ownerSeen[key] === undefined ? 0 : ownerSeen[key]
        ownerSeen[key] = seen + 1
        const owner = f.agentId ? agentsById[f.agentId] : null
        filePosIndex[f.path] = owner ? filePos(owner, seen, f) : { x: 60, y: 60 }
        if (f.agentId) {
          const cnt = agentFileCount[f.agentId]
          if (cnt === undefined) agentFileCount[f.agentId] = { total: 1, fresh: f.isNew ? 1 : 0 }
          else { cnt.total += 1; if (f.isNew) cnt.fresh += 1 }
        }
      }
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
            }, 5000)
          }
        }
        if (timer !== undefined && typeof timer.timeout === 'function') schedule()
        return function () { stopped = true; if (dispose) dispose() }
      }, [])
      React.useEffect(function () {
        viewRef.current.x = pan.x
        viewRef.current.y = pan.y
        viewRef.current.z = zoom
        paletteRef.current = readPalette()
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
        setToast({ id: nextId('t'), text: ok ? '\u5df2\u5bfc\u51fa JSON' : '\u5bfc\u51fa\u5931\u8d25' })
      }
      function exportMarkdown() {
        const st0 = store.get()
        const md = buildMarkdown(st0)
        const ok = downloadText(
          'agent-canvas-' + exportStamp() + '.md',
          md,
          'text/markdown;charset=utf-8',
        )
        setToast({ id: nextId('t'), text: ok ? '\u5df2\u5bfc\u51fa Markdown' : '\u5bfc\u51fa\u5931\u8d25' })
      }
      async function exportMarkdownToWorkspace() {
        const st0 = store.get()
        if (!st0.workspace) {
          setToast({ id: nextId('t'), text: '\u8bf7\u5148\u7ed1\u5b9a\u5de5\u4f5c\u533a' })
          return
        }
        const md = buildMarkdown(st0)
        const target = st0.workspace.replace(/\/+$/, '') + '/AGENT-CANVAS.md'
        const r = await hostCall('canvas-export-file', { path: target, content: md }, 15000)
        if (r.ok) {
          setToast({ id: nextId('t'), text: '\u5df2\u5199\u5165 ' + target })
          return
        }
        const saved = downloadText('agent-canvas-' + exportStamp() + '.md', md, 'text/markdown;charset=utf-8')
        setToast({ id: nextId('t'), text: saved
          ? ('\u5199\u5165\u5de5\u4f5c\u533a\u5931\u8d25\uff08' + (r.error || '') + '\uff09\uff0c\u5df2\u6539\u4e3a\u4e0b\u8f7d')
          : ('\u5199\u5165\u5931\u8d25: ' + (r.error || '')) })
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
          setToast({ id: nextId('t'), text: '\u751f\u6210\u56fe\u7247\u5931\u8d25' })
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
          setToast({ id: nextId('t'), text: '\u5df2\u5bfc\u51fa PNG' })
        } catch (e) {
          setToast({ id: nextId('t'), text: '\u5bfc\u51fa PNG \u5931\u8d25: ' + String((e && e.message) || e) })
        }
      }
      function openInspector(agent) {
        store.set({ inspectId: agent.id, activeAgentId: agent.id })
      }
      function closeInspector() {
        store.set({ inspectId: null })
      }
      async function rebindAgent(agent) {
        const st0 = store.get()
        if (!st0.workspace) {
          setToast({ id: nextId('t'), text: '\u8bf7\u5148\u70b9\u300c\u9009\u5de5\u4f5c\u533a\u300d' })
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
          setToast({ id: nextId('t'), text: '\u8bf7\u5148\u70b9\u300c\u9009\u5de5\u4f5c\u533a\u300d' })
          return
        }
        const lines = ['\u8d1f\u8d23\u8fd9\u4e9b\u6587\u4ef6\uff08\u6765\u81ea\u753b\u5e03\u9009\u62e9\uff09:']
        for (let i = 0; i < picked.length && i < 40; i++) lines.push('- ' + picked[i].path)
        lines.push('')
        lines.push('\u53ea\u6539\u8fd9\u4e9b\u6587\u4ef6\uff0c\u4e0d\u8981\u52a8\u5176\u5b83\u6587\u4ef6\u3002')
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
          setWsBrowseErr('\u65e0\u6cd5\u5217\u51fa ' + p + '\uff1a' + String((r && r.error) || '\u672a\u77e5\u9519\u8bef'))
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
          setFormErr('\u8bf7\u5148\u586b\u5199\u5de5\u4f5c\u533a\u7684\u7edd\u5bf9\u8def\u5f84')
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
          setFormErr('\u65e0\u6cd5\u8bbf\u95ee ' + p + '\uff1a' + String((r && r.error) || '\u672a\u77e5\u9519\u8bef') + '\uff08\u8def\u5f84\u5fc5\u987b\u5df2\u5b58\u5728\uff09')
          return false
        }
        if (r.isDirectory !== true && r.type !== undefined && r.type !== null && r.type !== 'directory') {
          setFormErr(p + ' \u4e0d\u662f\u4e00\u4e2a\u76ee\u5f55')
          return false
        }
        const resolved = typeof r.path === 'string' && r.path.length > 0 ? r.path : p
        store.set({ workspace: resolved, wsError: null })
        lastScanRoot = null
        lastRefreshSig = null
        setForm(null)
        setFormErr(null)
        setToast({ id: nextId('t'), text: '\u5df2\u7ed1\u5b9a\u5de5\u4f5c\u533a\uff1a' + resolved })
        refresh()
        return true
      }
      async function tryNativePick() {
        const ui = ctx.get('uiWorkspace')
        if (ui === undefined || typeof ui.pickDirectory !== 'function') {
          setFormErr('\u5f53\u524d\u754c\u9762\u6ca1\u6709\u63d0\u4f9b\u7cfb\u7edf\u76ee\u5f55\u9009\u62e9\u5668\uff0c\u8bf7\u5728\u4e0b\u9762\u624b\u52a8\u586b\u5199\u7edd\u5bf9\u8def\u5f84\u3002')
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
          setFormErr('\u7cfb\u7edf\u9009\u62e9\u5668\u4e0d\u53ef\u7528\uff1a' + errText + '\u3002\u8bf7\u5728\u4e0b\u9762\u624b\u52a8\u586b\u5199\u7edd\u5bf9\u8def\u5f84\u3002')
          return
        }
        if (typeof picked !== 'string' || picked.length === 0) {
          setFormErr('\u5df2\u53d6\u6d88\u9009\u62e9\u3002\u53ef\u5728\u4e0b\u9762\u624b\u52a8\u586b\u5199\u7edd\u5bf9\u8def\u5f84\u3002')
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
          return { ok: false, error: '\u8bf7\u5148\u70b9\u300c\u9009\u5de5\u4f5c\u533a\u300d\u7ed1\u5b9a\u4e00\u4e2a\u6587\u4ef6\u5939\uff0c\u65b0\u4f1a\u8bdd\u9700\u8981\u5728\u5b83\u91cc\u9762\u5efa\u5b50\u76ee\u5f55\u3002' }
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
                errors.push('\u54cd\u5e94\u8d85\u65f6\u4f46\u4f1a\u8bdd\u5df2\u521b\u5efa\uff0c\u5df2\u81ea\u52a8\u8ba4\u9886\uff1a' + adopted)
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
        if (!res) return { ok: false, error: '\u521b\u5efa\u4f1a\u8bdd\u5931\u8d25\n' + errors.join('\n') }
        if (used && baselines[used] === undefined && fresh) baselines[used] = {}
        const warning = typed && !used
          ? '\u6307\u5b9a\u7684\u5de5\u4f5c\u76ee\u5f55\u4e0d\u53ef\u7528\uff0c\u5df2\u56de\u9000\u5230\u9ed8\u8ba4\u76ee\u5f55'
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
          setToast({ id: nextId('t'), text: '\u8bf7\u5148\u70b9\u300c\u9009\u5de5\u4f5c\u533a\u300d' })
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
            return a.id === id ? merge(a, { pending: false, error: '\u5f02\u5e38\uff1a' + String((e && e.message) || e) }) : a
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
          h('div', { key: 'mission', className: 'acx-sm' }, a.mission ? ('\u4f7f\u547d: ' + firstLine(a.mission, 80)) : '\u4f7f\u547d: (\u672a\u8bbe\u7f6e)'),
          h('div', { key: 'scope', className: 'acx-hsect' },
            h('div', { className: 'acx-hlab' }, '\u638c\u7ba1\u7684\u4e0a\u4e0b\u6587\u8303\u56f4'),
            h('div', { className: 'acx-mono' }, a.cwd || '(\u5de5\u4f5c\u76ee\u5f55\u672a\u77e5)'),
            h('div', { className: 'acx-sm' }, '\u753b\u5e03\u6587\u4ef6\u8282\u70b9 ' + String(mine.length) + ' \u4e2a\uff0c\u5176\u4e2d\u672c\u4f1a\u8bdd\u65b0\u5efa ' + String(fresh.length) + ' \u4e2a'),
            mine.length > 0 ? h('div', { className: 'acx-flist' }, shown.map(function (f) {
              return h('div', { key: f.path, className: 'acx-frow' },
                h('span', { className: f.isNew ? 'acx-ok' : '' }, f.isNew ? 'new' : '   '),
                h('span', { style: { color: 'var(--dsw-alias-label-secondary,inherit)' } }, f.rel || f.name),
              )
            })) : h('div', { className: 'acx-sm' }, '\u8fd8\u6ca1\u6709\u6587\u4ef6\uff1bagent \u521b\u5efa\u6587\u4ef6\u540e\u4f1a\u81ea\u52a8\u51fa\u73b0\u5728\u753b\u5e03\u4e0a'),
          ),
          h('div', { key: 'sess', className: 'acx-hsect' },
            h('div', { className: 'acx-hlab' }, 'DSH \u4f1a\u8bdd\uff08\u6295\u5f71\uff09'),
            h('div', { className: 'acx-mono' }, a.sessionId || '(\u65e0)'),
            h('div', { className: 'acx-sm' }, (sess && sess.live ? 'live' : 'cold') + ' \u00b7 \u9009\u4e2d\u5373\u53ef\u804a\u5929'),
            a.missing ? h('div', { className: 'acx-sm acx-warn' }, '\u4f1a\u8bdd\u672a\u5728\u5217\u8868\u4e2d\uff08\u53ef\u80fd\u5df2\u5f52\u6863\uff09\uff0c\u53d1\u9001\u53ef\u80fd\u5931\u8d25') : null,
          ),
        ]
      }
      function fileInfoRows(f) {
        const owner = findAgent(st.agents, f.agentId)
        return [
          h('div', { key: 'path', className: 'acx-mono' }, f.path),
          h('div', { key: 'meta', className: 'acx-sm' }, (f.type === 'directory' ? '\u76ee\u5f55' : '\u6587\u4ef6') + (f.size !== null && f.type !== 'directory' ? ' \u00b7 ' + fmtSize(f.size) : '')),
          h('div', { key: 'owner', className: 'acx-hsect' },
            h('div', { className: 'acx-hlab' }, '\u5f52\u5c5e agent'),
            h('div', null, owner ? owner.name : '(\u672a\u5f52\u5c5e)'),
            f.isNew ? h('div', { className: 'acx-ok' }, '\u753b\u5e03\u5f00\u59cb\u76d1\u89c6\u540e\u65b0\u51fa\u73b0\uff08\u5f88\u53ef\u80fd\u662f agent \u521b\u5efa\u7684\uff09') : null,
            h('div', { className: 'acx-sm' }, '\u5355\u51fb\u9009\u4e2d\uff0c\u9009\u4e2d\u540e\u53ef\u57fa\u4e8e\u5b83\u521b\u5efa\u65b0 agent'),
          ),
        ]
      }
      const pickedFiles = st.files.filter(function (f) { return st.fileSel.indexOf(f.path) >= 0 })
      const bar = h('div', { className: 'acx-bar' },
        h('b', null, 'Agent Canvas'),
        h('button', {
          className: st.dock ? 'acx-btn acx-primary' : 'acx-btn',
          onClick: function () { store.set({ dock: !store.get().dock }) },
        }, st.dock ? '\u4f1a\u8bdd \u5f00' : '\u4f1a\u8bdd'),
        h('button', {
          className: st.workspace ? 'acx-btn' : 'acx-btn acx-primary',
          onClick: function () { openWorkspaceForm(null) },
        }, st.workspace ? '\u5de5\u4f5c\u533a: ' + basename(st.workspace) : '\u7ed1\u5b9a\u5de5\u4f5c\u533a'),
        h('button', {
          className: st.mode === 'file' ? 'acx-btn acx-primary' : 'acx-btn',
          onClick: function () { store.set({ mode: 'file' }) },
        }, '\u79fb\u52a8\u6587\u4ef6'),
        h('button', {
          className: st.mode === 'agent' ? 'acx-btn acx-primary' : 'acx-btn',
          onClick: function () { store.set({ mode: 'agent' }) },
        }, '\u79fb\u52a8 Agent'),
        h('button', { className: 'acx-btn acx-primary', onClick: spawnAgent }, '+ Agent'),
        h('button', {
          className: 'acx-btn',
          disabled: pickedFiles.length === 0,
          onClick: spawnAgentFromSelection,
        }, pickedFiles.length > 0 ? ('\u57fa\u4e8e\u9009\u4e2d ' + String(pickedFiles.length) + ' \u4e2a\u6587\u4ef6\u5efa Agent') : '\u57fa\u4e8e\u9009\u4e2d\u6587\u4ef6\u5efa Agent'),
        h('button', {
          className: multiMode ? 'acx-btn acx-primary' : 'acx-btn',
          onClick: function () { setMultiMode(!multiMode) },
        }, multiMode ? '\u591a\u9009 \u5f00' : '\u591a\u9009 \u5173'),
        h('button', { className: 'acx-btn', onClick: openProjectForm }, '\u6295\u5f71\u4f1a\u8bdd'),
        h('button', { className: 'acx-btn', onClick: exportPng }, '\u5bfc\u51fa PNG'),
        h('button', { className: 'acx-btn', onClick: exportJson }, '\u5bfc\u51fa JSON'),
        h('button', { className: 'acx-btn', onClick: exportMarkdown }, '\u5bfc\u51fa MD'),
        h('button', { className: 'acx-btn', onClick: exportMarkdownToWorkspace }, '\u5199\u5165\u5de5\u4f5c\u533a'),
        h('span', { className: 'acx-spacer' }),
        h('button', { className: 'acx-btn', onClick: function () { setZoom(function (z) { return z <= 0.5 ? 0.5 : Math.round((z - 0.25) * 100) / 100 }) } }, '-'),
        h('button', { className: 'acx-btn', onClick: function () { setZoom(1) } }, Math.round(zoom * 100) + '%'),
        h('button', { className: 'acx-btn', onClick: function () { setZoom(function (z) { return z >= 1.5 ? 1.5 : Math.round((z + 0.25) * 100) / 100 }) } }, '+'),
        h('button', { className: 'acx-btn', onClick: function () {
          for (const k in manual) delete manual[k]
          store.set({})
        } }, '\u91cd\u6392'),
        h('button', { className: 'acx-btn', onClick: function () { setPan({ x: 36, y: 30 }) } }, '\u590d\u4f4d'),
        h('button', { className: 'acx-btn', onClick: forceRescan }, '\u91cd\u626b'),
        h('button', { className: 'acx-btn acx-danger', onClick: function () {
          clearCache()
          for (const k in manual) delete manual[k]
          store.set({ agents: [], agentSel: [], activeAgentId: null, workspace: null, fileSel: [], files: [], wsError: null })
          refresh()
        } }, '\u6e05\u7a7a\u753b\u5e03'),
      )
      let formEl = null
      const inspectAgent = st.inspectId ? findAgent(st.agents, st.inspectId) : null
      if (form && form.kind === 'workspace') {
        const curWs = st.workspace
        const browseDirs = wsBrowseItems.filter(function (e) { return e.type === 'directory' })
        formEl = h('div', { className: 'acx-form' },
          h('div', { className: 'acx-form-title' }, '\u7ed1\u5b9a\u5de5\u4f5c\u533a\u6587\u4ef6\u5939'),
          h('div', { className: 'acx-hint' }, '\u4e00\u4e2a canvas \u5bf9\u5e94\u4e00\u4e2a\u5de5\u4f5c\u533a\u6587\u4ef6\u5939\u3002\u8f93\u5165\u5b83\u7684\u7edd\u5bf9\u8def\u5f84\u540e\u70b9\u300c\u7ed1\u5b9a\u300d\uff0cHost \u4f1a\u5148\u6821\u9a8c\u8be5\u8def\u5f84\u662f\u5426\u5b58\u5728\u4e14\u4e3a\u76ee\u5f55\uff1b\u7ed1\u5b9a\u540e\u8be5\u76ee\u5f55\u6811\u91cc\u7684\u6bcf\u4e2a\u6587\u4ef6\u90fd\u4f1a\u6210\u4e3a\u8282\u70b9\u3002'),
          h('div', { className: 'acx-row' },
            h('input', {
              className: 'acx-inp',
              style: { flex: '1 1 260px', minWidth: '180px' },
              value: wsPath,
              placeholder: st.home ? (st.home + '/project') : '/\u7edd\u5bf9/\u8def\u5f84',
              onChange: function (e) { setWsPath(e.target.value) },
              onKeyDown: function (e) { if (e.key === 'Enter') { e.preventDefault(); bindWorkspace(wsPath) } },
            }),
          ),
          h('div', { className: 'acx-row' },
            h('button', { className: 'acx-btn acx-primary', disabled: wsBusy, onClick: function () { bindWorkspace(wsPath) } }, wsBusy ? '\u6821\u9a8c\u4e2d\u2026' : '\u7ed1\u5b9a'),
            h('button', { className: 'acx-btn', disabled: wsBusy, onClick: function () { openBrowse(wsPath || st.home || '/') } }, '\u6d4f\u89c8\u76ee\u5f55'),
            h('button', { className: 'acx-btn', disabled: wsBusy, onClick: tryNativePick }, '\u7528\u7cfb\u7edf\u9009\u62e9\u5668'),
            st.home ? h('button', { className: 'acx-btn', disabled: wsBusy, onClick: function () { setWsPath(st.home) } }, '\u4e3b\u76ee\u5f55') : null,
            curWs ? h('button', { className: 'acx-btn', disabled: wsBusy, onClick: function () { setWsPath(curWs) } }, '\u5f53\u524d\u5de5\u4f5c\u533a') : null,
          ),
          curWs ? h('div', { className: 'acx-hint' }, '\u5f53\u524d\u5df2\u7ed1\u5b9a\uff1a' + curWs) : null,
          wsBrowse !== null ? h('div', null,
            h('div', { className: 'acx-row' },
              h('span', { className: 'acx-mono' }, wsBrowse),
              h('span', { className: 'acx-spacer' }),
              h('button', { className: 'acx-btn', onClick: function () { setWsPath(wsBrowse); setWsBrowse(null); setWsBrowseErr(null) } }, '\u7528\u8fd9\u4e2a\u76ee\u5f55'),
              wsBrowse !== '/' ? h('button', { className: 'acx-btn', onClick: function () { openBrowse(dirname(wsBrowse)) } }, '\u4e0a\u4e00\u5c42') : null,
              h('button', { className: 'acx-btn', onClick: function () { setWsBrowse(null); setWsBrowseErr(null) } }, '\u6536\u8d77'),
            ),
            wsBrowseErr ? h('div', { className: 'acx-errbox' }, wsBrowseErr) : null,
            h('div', { className: 'acx-slist' },
              browseDirs.length === 0
                ? h('div', { className: 'acx-empty' }, '(\u6ca1\u6709\u5b50\u76ee\u5f55)')
                : browseDirs.map(function (e) {
                    return h('div', { key: e.path, className: 'acx-srow', onClick: function () { openBrowse(e.path) } },
                      h('div', { className: 'acx-st' }, '[D] ' + e.name),
                    )
                  }),
            ),
          ) : null,
          formErr ? h('div', { className: 'acx-errbox' }, formErr) : null,
          h('div', { className: 'acx-btns' },
            h('button', { className: 'acx-btn', onClick: closeForm }, '\u5173\u95ed'),
          ),
        )
      } else if (inspectAgent) {
        const options = [h('option', { key: '__default', value: '' }, '\u9ed8\u8ba4 preset')]
        for (let i = 0; i < presets.length; i++) options.push(h('option', { key: presets[i].id, value: presets[i].id }, presets[i].name))
        const sess = st.sessions[inspectAgent.sessionId] || null
        formEl = h('div', { className: 'acx-form' },
          h('div', { className: 'acx-form-title' }, 'Agent ' + inspectAgent.name),
          inspectAgent.pending ? h('div', { className: 'acx-hint' }, '\u6b63\u5728\u521b\u5efa\u4f1a\u8bdd\u2026') : null,
          inspectAgent.error ? h('div', { className: 'acx-errbox' }, inspectAgent.error) : null,
          h('div', { className: 'acx-row' },
            h('span', { className: 'acx-sm' }, '\u540d\u79f0'),
            h('input', {
              className: 'acx-inp',
              value: inspectAgent.name,
              onChange: function (e) { updateAgent(inspectAgent.id, { name: e.target.value }) },
            }),
          ),
          h('div', { className: 'acx-row' },
            h('span', { className: 'acx-sm' }, '\u4f7f\u547d prompt'),
          ),
          h('textarea', {
            className: 'acx-ta',
            value: inspectAgent.mission || '',
            placeholder: '\u4f8b\u5982\uff1a\u5728\u5de5\u4f5c\u533a\u5185\u5199\u4e00\u4e2a hello.py \u5e76\u8fd0\u884c\u5b83',
            onChange: function (e) { updateAgent(inspectAgent.id, { mission: e.target.value }) },
          }),
          h('div', { className: 'acx-row' },
            h('span', { className: 'acx-sm' }, 'Agent preset'),
            h('select', { className: 'acx-sel', value: '', onChange: function (e) { if (e.target.value) rebindAgent(merge(inspectAgent, { preset: e.target.value })) } }, options),
          ),
          h('div', { className: 'acx-hsect' },
            h('div', { className: 'acx-hlab' }, '\u4f1a\u8bdd\uff08\u4f5c\u4e3a DSH \u4f1a\u8bdd\u7684\u6295\u5f71\uff09'),
            h('div', { className: 'acx-mono' }, inspectAgent.sessionId || '(\u5c1a\u672a\u521b\u5efa)'),
            inspectAgent.cwd ? h('div', { className: 'acx-mono' }, inspectAgent.cwd) : null,
            h('div', { className: 'acx-sm' }, sess && sess.live ? 'live' : 'cold'),
          ),
          h('div', { className: 'acx-btns' },
            h('button', { className: 'acx-btn', onClick: function () {
              const err = openInSidebar(inspectAgent.sessionId)
              if (err) setToast({ id: nextId('t'), text: err })
            } }, '\u5728\u5de6\u4fa7\u6253\u5f00'),
            h('button', { className: 'acx-btn', onClick: function () { rebindAgent(inspectAgent) } }, inspectAgent.sessionId ? '\u91cd\u5efa\u4f1a\u8bdd' : '\u521b\u5efa\u4f1a\u8bdd'),
            h('button', { className: 'acx-btn', onClick: function () { forkAgent(inspectAgent) } }, '\u5206\u8eab Fork'),
            h('span', { className: 'acx-spacer' }),
            h('button', { className: 'acx-btn acx-danger', onClick: function () { removeAgent(inspectAgent.id); closeInspector() } }, '\u79fb\u9664'),
            h('button', { className: 'acx-btn', onClick: closeInspector }, '\u5b8c\u6210'),
          ),
        )
      } else if (form && form.kind === 'project') {
        const source = sessionItems.length > 0 ? sessionItems : st.sessionList
        const needle = projectQuery.trim().toLowerCase()
        const filtered = source.filter(function (s) {
          if (!needle) return true
          return (String(s.title || '') + ' ' + String(s.cwd || '') + ' ' + String(s.id) + ' ' + String(s.origin || '')).toLowerCase().indexOf(needle) >= 0
        })
        formEl = h('div', { className: 'acx-form' },
          h('div', { className: 'acx-form-title' }, '\u6295\u5f71\u4e00\u4e2a\u5df2\u6709\u4f1a\u8bdd\uff08\u5de6\u4fa7\u680f session \u7684\u6295\u5f71\uff09'),
          h('div', { className: 'acx-hint' }, '\u5217\u8868\u76f4\u63a5\u53ef\u70b9\u9009\u3002\u88ab\u6295\u5f71\u7684 agent \u4e0e\u5de6\u4fa7\u680f\u662f\u540c\u4e00\u4e2a\u4f1a\u8bdd\uff1a\u5728\u8fd9\u91cc\u53d1\u6d88\u606f\uff0c\u5de6\u4fa7\u680f\u4e5f\u80fd\u770b\u5230\uff1b\u5b83\u7684\u5de5\u4f5c\u76ee\u5f55\u4e0b\u7684\u6587\u4ef6\u4e5f\u4f1a\u663e\u793a\u5728\u753b\u5e03\u4e0a\u3002'),
          h('div', { className: 'acx-row' },
            h('input', {
              className: 'acx-inp',
              value: projectQuery,
              placeholder: '\u8fc7\u6ee4 title / cwd / id',
              onChange: function (e) { setProjectQuery(e.target.value) },
            }),
            h('button', { className: 'acx-btn', onClick: function () {
              hostCall('canvas-sessions', { titles: true, titleLimit: 20 }, 30000).then(function (r) {
                if (r.ok) { setSessionItems(r.items || []); setFormErr(null) }
                else setFormErr(r.error || 'list failed')
              })
            } }, '\u5237\u65b0'),
            h('span', { className: 'acx-sm' }, String(filtered.length) + ' / ' + String(source.length)),
          ),
          formErr ? h('div', { className: 'acx-errbox' }, formErr) : null,
          h('div', { className: 'acx-slist' },
            filtered.length === 0
              ? h('div', { className: 'acx-empty' }, '\u6ca1\u6709\u5339\u914d\u7684\u4f1a\u8bdd')
              : filtered.slice(0, 300).map(function (s) {
                  return h('div', { key: s.id, className: 'acx-srow', onClick: function () { projectSession(s) } },
                    h('div', { className: 'acx-st' }, (s.title || '(\u672a\u547d\u540d\u4f1a\u8bdd)') + (s.live ? ' \u00b7 live' : '')),
                    h('div', { className: 'acx-sm' }, s.id + (s.cwd ? ' \u00b7 ' + s.cwd : '') + (s.origin ? ' \u00b7 ' + s.origin : '')),
                  )
                }),
          ),
          h('div', { className: 'acx-btns' },
            h('span', { className: 'acx-spacer' }),
            h('button', { className: 'acx-btn', onClick: closeForm }, '\u5173\u95ed'),
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
              '\u5148\u70b9\u300c\u7ed1\u5b9a\u5de5\u4f5c\u533a\u300d\u7ed1\u5b9a\u4e00\u4e2a\u6587\u4ef6\u5939\uff0c\u518d\u7528\u300c+ Agent\u300d\u521b\u5efa\u4f1a\u8bdd\u3002\u6bcf\u4e2a agent \u5728\u8be5\u5de5\u4f5c\u533a\u5185\u62e5\u6709\u81ea\u5df1\u7684\u5b50\u76ee\u5f55\uff0c\u5b83\u521b\u5efa\u7684\u6bcf\u4e2a\u6587\u4ef6\u90fd\u4f1a\u4f5c\u4e3a\u8282\u70b9\u51fa\u73b0\u3002')
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
              h('button', { className: 'acx-btn', onClick: function () { setInfo(null) } }, '\u5173\u95ed'),
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
              h('button', { className: 'acx-btn', onClick: function () { setInfo(null) } }, '\u5173\u95ed'),
            ),
            fileInfoRows(f),
          )
        }
      }
      const legend = h('div', { className: 'acx-legend' },
        h('span', null, st.workspace ? basename(st.workspace) : '(\u672a\u9009\u5de5\u4f5c\u533a)'),
        h('span', null, 'agent ' + String(st.agents.length) + ' \u00b7 \u6587\u4ef6 ' + String(st.files.length) + (lastDrawCount > 0 ? ' \u00b7 \u5f53\u5e27\u7ed8\u5236 ' + String(lastDrawCount) : '')),
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
    function RunCard() {
      const st = useStore()
      const m1 = React.useState('')
      const msg = m1[0]
      const setMsg = m1[1]
      function openPanel() {
        const layout = ctx.get('layout')
        if (layout === undefined || typeof layout.selectPanel !== 'function') {
          setMsg('layout \u670d\u52a1\u4e0d\u53ef\u7528\uff1a\u8bf7\u70b9\u5de6\u4fa7\u680f\u7684 Agent Canvas \u56fe\u6807')
          return
        }
        try {
          layout.selectPanel(PANEL_ID)
          setMsg('\u5df2\u5207\u6362\u5230 Agent Canvas')
        } catch (e) {
          setMsg('\u5207\u6362\u5931\u8d25: ' + String((e && e.message) || e))
        }
      }
      return h('div', { className: 'acx-inline' },
        h('div', { style: { fontWeight: 600 } }, 'Agent Canvas \u00b7 \u56fe\u5de5\u4f5c\u53f0'),
        h('div', { className: 'acx-sm' }, 'agent ' + String(st.agents.length) + ' \u00b7 \u6587\u4ef6\u8282\u70b9 ' + String(st.files.length) + ' \u00b7 \u5df2\u9009 agent ' + String(st.agentSel.length) + ' \u00b7 \u5df2\u9009\u6587\u4ef6 ' + String(st.fileSel.length)),
        h('div', { style: { display: 'flex', gap: '7px', flexWrap: 'wrap' } },
          h('button', { className: 'acx-btn acx-primary', onClick: openPanel }, '\u6253\u5f00\u753b\u5e03 Screen'),
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
    console.log('[agent-canvas] client apply pkg-21: panel "' + PANEL_ID + '" registered, ws=' + String(store.get().workspace) + ' touch=' + String(detectTouch()))
  },
}
