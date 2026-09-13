'use strict'
// patch24b: md content on the canvas node, zoom controls, perf HUD, variable-height hit test.
const fs = require('fs')

function apply(path, pairs) {
  let t = fs.readFileSync(path, 'utf8')
  for (const [from, to, label] of pairs) {
    const n = t.split(from).length - 1
    if (n === 0) throw new Error('ANCHOR MISSING (' + path + '): ' + label)
    if (n > 1) throw new Error('ANCHOR NOT UNIQUE (' + n + ') (' + path + '): ' + label)
    t = t.replace(from, to)
  }
  fs.writeFileSync(path, t)
  console.log('patched', path, t.length, 'bytes')
}

// ---------------- HOST: read a text file for on-canvas md preview ----------------
apply('/tmp/acx/v21.host.js', [
  [
    "    harness.handle('canvas-export-file', async (args) => {",
    `    harness.handle('canvas-read-text', async (args) => {
      if (fs === undefined) return { ok: false, error: 'fs service unavailable' }
      if (!args || typeof args.path !== 'string' || args.path.trim().length === 0) {
        return { ok: false, error: 'path required' }
      }
      try {
        const target = await fs.resolve(args.path.trim())
        const info = await fs.stat(target).catch(() => undefined)
        if (info !== undefined && info !== null && info.type === 'directory') {
          return { ok: false, error: 'is a directory' }
        }
        const size = info && typeof info.size === 'number' ? info.size : null
        if (size !== null && size > 262144) {
          return { ok: true, text: '', truncated: true, size: size }
        }
        const text = await fs.readText(target)
        const capped = typeof text === 'string' && text.length > 64000 ? text.slice(0, 64000) : text
        return { ok: true, text: capped, truncated: typeof text === 'string' && text.length > 64000, size: size }
      } catch (e) {
        return fail(e)
      }
    })
    harness.handle('canvas-export-file', async (args) => {`,
    'read-text handler',
  ],
])

// ---------------- CLIENT ----------------
const C = '/tmp/acx/v21.client.js'

apply(C, [
  // mdText carried on the file node
  [
    `            files.push({
              path: e.path,
              name: e.name,
              rel: e.rel,
              type: e.type,
              size: e.size,
              agentId: assignOwner(agents, e.path),
              root: ws,
              isNew: baselines[ws][e.path] !== true,
            })`,
    `            const prevMd = mdCache[e.path]
            files.push({
              path: e.path,
              name: e.name,
              rel: e.rel,
              type: e.type,
              size: e.size,
              agentId: assignOwner(agents, e.path),
              root: ws,
              isNew: baselines[ws][e.path] !== true,
              mdText: typeof prevMd === 'string' ? prevMd : null,
            })`,
    'carry mdText',
  ],

  // hit test must use the real node height so md cards are clickable over their full body
  [
    "          if (wx >= p.x && wx <= p.x + FILE_W && wy >= p.y && wy <= p.y + FILE_H) return { kind: 'file', file: f }",
    "          if (wx >= p.x && wx <= p.x + FILE_W && wy >= p.y && wy <= p.y + nodeH(f)) return { kind: 'file', file: f }",
    'hitTest height',
  ],

  // edges: cull using the real node height
  [
    "          const p = livePosOf(f)\n          if (!vis(p.x, p.y, FILE_W, FILE_H)) continue\n          const ap = agentPosOf(owner)",
    "          const p = livePosOf(f)\n          if (!vis(p.x, p.y, FILE_W, nodeH(f))) continue\n          const ap = agentPosOf(owner)",
    'edge cull height',
  ],

  // drag start: use the real node position (already filePosOf) - no change needed.

  // ---------- file node drawing: hierarchy + markdown body ----------
  [
    `        for (let i = 0; i < st.files.length; i++) {
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
        }`,
    `        for (let i = 0; i < st.files.length; i++) {
          const f = st.files[i]
          const p = livePosOf(f)
          const nh = nodeH(f)
          if (!vis(p.x, p.y, FILE_W, nh)) continue
          drawn += 1
          const isDir = f.type === 'directory'
          const isMd = isMarkdown(f)
          roundRectPath(g, p.x, p.y, FILE_W, nh, 9)
          g.fillStyle = isDir ? pal.dirBg : pal.fileBg
          g.fill()
          g.lineWidth = 1
          g.strokeStyle = f.isNew ? pal.fresh : pal.border
          g.stroke()
          if (st.fileSel.indexOf(f.path) >= 0) {
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
              g.fillText(clipText(g, '\\u8bfb\\u53d6\\u4e2d\\u2026', FILE_W - 18), p.x + 8, p.y + 40)
            } else if (lines.length === 0) {
              g.fillStyle = pal.dim
              g.fillText(clipText(g, '(\\u7a7a\\u6587\\u4ef6)', FILE_W - 18), p.x + 8, p.y + 40)
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
        }`,
    'md node drawing',
  ],

  // ---------- md text fetching + cache ----------
  [
    '    let fileScanMs = 6000',
    `    let fileScanMs = 6000
    // On-canvas markdown preview cache: path -> text. Kept across refreshes so the
    // canvas does not refetch every poll; capped so a big tree cannot blow memory.
    const mdCache = {}
    const mdFetching = {}
    const MD_FETCH_MAX = 12
    const MD_MAX_LINES = 6
    const MD_MAX_CHARS = 4000`,
    'md cache decl',
  ],

  // call md fetch after a scan commits
  [
    `          if (r.truncated) note = ws + ' 内容过多，仅显示前 4000 项'`,
    `          fetchMarkdown(files)
          if (r.truncated) note = ws + ' \\u5185\\u5bb9\\u8fc7\\u591a\\uff0c\\u4ec5\\u663e\\u793a\\u524d 4000 \\u9879'`,
    'trigger md fetch',
  ],

  // the fetcher itself, hung off refreshInner's sibling scope
  [
    '    function assignOwner(agents, filePath) {',
    `    // Read the first chunk of each .md node so drawGraph can show its content.
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
    function assignOwner(agents, filePath) {`,
    'md fetcher',
  ],
])

console.log('patch24b ok')
