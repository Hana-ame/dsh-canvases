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
