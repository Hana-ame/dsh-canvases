const fs = require('fs')
const c = fs.readFileSync('/tmp/acx/s18.client.js', 'utf8')
const h = fs.readFileSync('/tmp/acx/s18.host.js', 'utf8')
new Function(c)
new Function(h)

const checks = [
  // Requested interaction model
  ['mode switch: move files', /'\\u79fb\\u52a8\\u6587\\u4ef6'/.test(c)],
  ['mode switch: move agents', /'\\u79fb\\u52a8 Agent'/.test(c)],
  ['mode stored', /mode: cached\.mode === .agent./.test(c)],
  ['mode persisted', /mode: s\.mode/.test(c)],
  ['file drag gated by mode', /const canDrag = store\.get\(\)\.mode === 'file'/.test(c)],
  ['agent drag gated by mode', /const canDrag = store\.get\(\)\.mode === 'agent'/.test(c)],
  ['+ Agent creates instantly', /async function spawnAgent\(\)/.test(c)],
  ['instant node pre-placed', /pending: true/.test(c)],
  ['session bound after placement', /sessionId: r\.sessionId, cwd: r\.cwd \|\| suggested, pending: false/.test(c)],
  ['failure lands on node', /pending: false, error: \(r && r\.error\)/.test(c)],
  ['click opens inspector', /function openInspector\(agent\)/.test(c)],
  ['inspector panel exists', /const inspectAgent = st\.inspectId \? findAgent/.test(c)],
  ['inspector edits name', /updateAgent\(inspectAgent\.id, \{ name:/.test(c)],
  ['inspector edits mission', /updateAgent\(inspectAgent\.id, \{ mission:/.test(c)],
  ['inspector can rebind', /function rebindAgent\(agent\)/.test(c)],
  ['listing lists all files', /maxDepth: 8, limit: 4000/.test(c)],
  ['host caps raised', /Math\.min\(args\.maxDepth, 12\)/.test(h) && /Math\.min\(args\.limit, 5000\)/.test(h)],
  // Toolbar must be reachable and clickable above overlays.
  ['bar above dock', (function(){var i=c.indexOf('.acx-bar{');var b=Number(/z-index:(\d+)/.exec(c.slice(i,i+400))[1]);var j=c.indexOf('.acx-dock{');var d=Number(/z-index:(\d+)/.exec(c.slice(j,j+400))[1]);return b>d})()],
  ['bar above form and sheet', (function(){var i=c.indexOf('.acx-bar{');var b=Number(/z-index:(\d+)/.exec(c.slice(i,i+400))[1]);var f=c.indexOf('.acx-form{');var fz=Number(/z-index:(\d+)/.exec(c.slice(f,f+400))[1]);var sh=c.indexOf('.acx-sheet{');var sz=Number(/z-index:(\d+)/.exec(c.slice(sh,sh+400))[1]);return b>fz&&b>sz})()],
  ['bar wraps instead of hiding buttons', /flex-wrap:wrap;row-gap:6px/.test(c)],
  ['bar height capped', /max-height:40%/.test(c)],
  ['dock offset below bar', /\.acx-dock\{position:absolute;top:96px/.test(c)],
  ['export buttons present', /exportPng/.test(c) && /exportJson/.test(c) && /exportMarkdown/.test(c)],
  // Export capability
  ['export: PNG', /function exportPng\(\)/.test(c) && /'\\u5bfc\\u51fa PNG'/.test(c)],
  ['export: JSON', /function exportJson\(\)/.test(c) && /buildExportDoc\(st0\)/.test(c)],
  ['export: Markdown download', /function exportMarkdown\(\)/.test(c)],
  ['export: Markdown to workspace', /canvas-export-file/.test(c) && /AGENT-CANVAS\.md/.test(c)],
  ['export: workspace failure falls back to download', /const saved = downloadText/.test(c)],
  ['host: export write handler', /harness\.handle\('canvas-export-file'/.test(h) && /fs\.writeText/.test(h)],
  ['export builders defined', /function buildExportDoc/.test(c) && /function buildMarkdown/.test(c) && /function drawPng/.test(c)],
  ['export buttons in toolbar', (c.match(/exportStamp\(\) \+ '\.(json|md|png)'/g) || []).length >= 2],
  // No dead agent-form state
  ['no formMission', !/\bformMission\b/.test(c)],
  ['no formBusy', !/\bformBusy\b/.test(c)],
  ['no submitAgentForm', !/submitAgentForm/.test(c)],
  ['no openAgentForm', !/openAgentForm/.test(c)],
  // Prior fixes survive
  ['cache helpers', /function loadCache/.test(c) && /function saveCache/.test(c)],
  ['persist subscribed', /store\.subscribe\(persistSoon\)/.test(c)],
  ['workspace single root', /const dueScan = ws !== lastScanRoot/.test(c) && /hostCall\('canvas-list-files', \{ path: ws, maxDepth: 8, limit: 4000 \}/.test(c)],
  ['title gate', /args && args\.titles === true/.test(h)],
  ['refresh reentrancy guard', /let refreshing = false/.test(c)],
  ['user message fix', /role: 'user', text: blocksText\(data\.content\)/.test(c)],
  ['host 9 handlers', (h.match(/harness\.handle\(/g) || []).length === 9],
  ['client 3 slots', (c.match(/slots\.inject\(/g) || []).length === 3],
]

let bad = 0
for (const [label, ok] of checks) {
  if (!ok) bad++
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + label)
}
console.log(bad ? 'FAILURES ' + bad : 'ALL PASS')
console.log('bytes client', c.length, 'host', h.length)
