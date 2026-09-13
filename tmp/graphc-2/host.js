const str = (v) => (v === undefined || v === null ? null : String(v))
const blocksText = (content) => {
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
const abortShim = () => ({
  aborted: false,
  reason: undefined,
  onabort: null,
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() { return true },
  throwIfAborted() {},
})
const fail = (e) => ({ ok: false, error: String((e && e.message) || e || 'unknown error') })
const SKIP = { node_modules: true, '.git': true, '.cache': true, dist: true, build: true }
// The canvas UI is ~120 KB of plain JavaScript. Keeping it out of the package
// parameter lets it be edited and re-checked without redefining the whole
// Package, and keeps the definition reviewable. These paths are tried in order.
const UI_SRC_CANDIDATES = [
  '/tmp/graphc-2/v21.client.js',
  '/home/lumin/.dsh/agent-canvas/ui.js',
]
const relOf = (rootPath, childPath) => {
  const r = String(rootPath).replace(/\/+$/, '')
  const c = String(childPath)
  if (c === r) return ''
  if (c.indexOf(r + '/') === 0) return c.slice(r.length + 1)
  return c
}
return {
  apply(ctx) {
    const sessionQuery = ctx.get('sessionQuery')
    const sessionController = ctx.get('sessionController')
    const agentPresets = ctx.get('agentPresets')
    const fs = ctx.get('fs')
    let reqSeq = 0
    let sessCache = null
    let sessCacheAt = 0
    const SESS_CACHE_MS = 10000
    console.log('[agent-canvas-2] host apply graphc-2', {
      sessionQuery: sessionQuery !== undefined,
      sessionController: sessionController !== undefined,
      agentPresets: agentPresets !== undefined,
      fs: fs !== undefined,
    })
    harness.handle('canvas-sessions', async (args) => {
      if (sessionQuery === undefined) return { ok: false, error: 'sessionQuery service unavailable' }
      try {
        const wantTitles = !!(args && args.titles === true)
        const titleLimit = args && typeof args.titleLimit === 'number' && args.titleLimit > 0
          ? Math.min(args.titleLimit, 40)
          : 20
        const nowTs = Date.now()
        let records
        if (sessCache !== null && (nowTs - sessCacheAt) < SESS_CACHE_MS) {
          records = sessCache
        } else {
          records = await sessionQuery.listSessions()
          sessCache = records
          sessCacheAt = nowTs
        }
        const list = Array.isArray(records) ? records.slice(0, 300) : []
        const items = []
        const ids = []
        for (let i = 0; i < list.length; i++) {
          const rec = list[i]
          const header = rec && rec.header
          if (!header) continue
          const id = String(header.id)
          ids.push(id)
          items.push({
            id: id,
            cwd: str(header.cwd),
            createdAt: typeof header.createdAt === 'number' ? header.createdAt : null,
            parentId: str(header.parentSession),
            origin: str(header.origin),
            live: rec.live === true,
            persisted: rec.persisted === true,
            title: null,
          })
        }
        if (ids.length > 0 && wantTitles) {
          try {
            const titles = await sessionQuery.readTitleSnapshots(ids.slice(0, titleLimit))
            const arr = Array.isArray(titles) ? titles : []
            for (let i = 0; i < arr.length; i++) {
              const t = arr[i]
              if (!t || t.status !== 'fulfilled' || !t.value || !t.value.title) continue
              const title = t.value.title.title
              if (typeof title !== 'string') continue
              const id = String(t.sessionId)
              for (let j = 0; j < items.length; j++) if (items[j].id === id) items[j].title = title
            }
          } catch (e) {
            console.error('[agent-canvas] title fold failed', e)
          }
        }
        return { ok: true, items: items }
      } catch (e) {
        return fail(e)
      }
    })
    harness.handle('canvas-presets', async () => {
      if (agentPresets === undefined) return { ok: true, items: [] }
      try {
        const list = await agentPresets.list()
        const arr = Array.isArray(list) ? list : []
        const items = []
        for (let i = 0; i < arr.length; i++) {
          const p = arr[i]
          if (!p) continue
          const id = str(p.id) || str(p.name)
          if (!id) continue
          items.push({ id: id, name: str(p.name) || id })
        }
        return { ok: true, items: items }
      } catch (e) {
        return fail(e)
      }
    })
    harness.handle('canvas-stat-dir', async (args) => {
      if (fs === undefined) return { ok: false, error: 'fs service unavailable' }
      if (!args || typeof args.path !== 'string' || args.path.trim().length === 0) {
        return { ok: false, error: 'path required' }
      }
      const want = args.path.trim()
      try {
        const target = await fs.resolve(want)
        const resolved = String(target.displayPath || want)
        let info = null
        try {
          info = await fs.stat(target)
        } catch (e) {
          info = null
        }
        if (info !== undefined && info !== null) {
          return {
            ok: true,
            path: resolved,
            type: String(info.type),
            size: typeof info.size === 'number' ? info.size : null,
            isDirectory: info.type === 'directory',
            via: 'stat',
          }
        }
        // stat can be unavailable or inconclusive here; a successful listing proves a directory
        try {
          const listed = await fs.listDir(target)
          if (Array.isArray(listed)) {
            return { ok: true, path: resolved, type: 'directory', size: null, isDirectory: true, via: 'listDir' }
          }
        } catch (e) {}
        return { ok: false, error: '路径不存在或不可访问：' + resolved, path: resolved, type: null }
      } catch (e) {
        return fail(e)
      }
    })
    harness.handle('canvas-list-files', async (args) => {
      if (fs === undefined) return { ok: false, error: 'fs service unavailable' }
      if (!args || typeof args.path !== 'string' || args.path.trim().length === 0) {
        return { ok: false, error: 'path required' }
      }
      const maxDepth = typeof args.maxDepth === 'number' && args.maxDepth >= 0 ? Math.min(args.maxDepth, 12) : 2
      const limit = typeof args.limit === 'number' && args.limit > 0 ? Math.min(args.limit, 5000) : 200
      try {
        const root = await fs.resolve(args.path.trim())
        const rootPath = String(root.displayPath || args.path.trim())
        const out = []
        const queue = [{ target: root, depth: 0 }]
        let truncated = false
        while (queue.length > 0 && out.length < limit) {
          const item = queue.shift()
          let listed
          try {
            listed = await fs.listDir(item.target)
          } catch (e) {
            continue
          }
          const arr = Array.isArray(listed) ? listed : []
          for (let i = 0; i < arr.length; i++) {
            const e = arr[i]
            if (!e) continue
            if (out.length >= limit) { truncated = true; break }
            const name = String(e.name)
            if (SKIP[name] === true) continue
            const childPath = String((e.target && e.target.displayPath) || '')
            if (!childPath) continue
            const isDir = e.type === 'directory'
            out.push({
              path: childPath,
              name: name,
              type: String(e.type),
              size: typeof e.size === 'number' ? e.size : null,
              rel: relOf(rootPath, childPath),
              depth: item.depth + 1,
            })
            if (isDir && item.depth + 1 < maxDepth && e.target) queue.push({ target: e.target, depth: item.depth + 1 })
          }
        }
        return { ok: true, root: rootPath, entries: out, truncated: truncated }
      } catch (e) {
        return fail(e)
      }
    })
    harness.handle('canvas-create-session', async (args) => {
      if (sessionController === undefined) return { ok: false, error: 'sessionController service unavailable' }
      try {
        const req = {}
        if (args && typeof args.cwd === 'string' && args.cwd.trim().length > 0) req.cwd = args.cwd.trim()
        if (args && typeof args.agentPreset === 'string' && args.agentPreset.length > 0) req.agentPreset = args.agentPreset
        const value = await sessionController.create(req)
        return {
          ok: true,
          sessionId: str(value && value.sessionId),
          agentPreset: str(value && value.agentPreset),
          cwd: req.cwd !== undefined ? req.cwd : null,
        }
      } catch (e) {
        return fail(e)
      }
    })
    harness.handle('canvas-fork-session', async (args) => {
      if (sessionController === undefined) return { ok: false, error: 'sessionController service unavailable' }
      try {
        if (!args || typeof args.sessionId !== 'string') return { ok: false, error: 'sessionId required' }
        const value = await sessionController.fork({ sessionId: args.sessionId })
        return { ok: true, sessionId: str(value && value.sessionId) }
      } catch (e) {
        return fail(e)
      }
    })
    harness.handle('canvas-read-session', async (args) => {
      if (sessionQuery === undefined) return { ok: false, error: 'sessionQuery service unavailable' }
      try {
        if (!args || typeof args.sessionId !== 'string') return { ok: false, error: 'sessionId required' }
        const snap = await sessionQuery.readSession(args.sessionId)
        const events = (snap && snap.events) || []
        const start = events.length > 400 ? events.length - 400 : 0
        const messages = []
        for (let i = start; i < events.length; i++) {
          const ev = events[i]
          if (!ev) continue
          const data = ev.data || {}
          if (ev.type === 'user/message') {
            messages.push({ key: 's' + String(ev.seq), seq: Number(ev.seq), role: 'user', text: blocksText(data.content) })
          } else if (ev.type === 'assistant/message') {
            messages.push({ key: 's' + String(ev.seq), seq: Number(ev.seq), role: 'assistant', text: blocksText(data.message && data.message.content) })
          } else if (ev.type === 'tool/call') {
            messages.push({ key: 's' + String(ev.seq), seq: Number(ev.seq), role: 'tool', text: String(data.name || 'tool') })
          }
        }
        return { ok: true, messages: messages, cwd: str(snap && snap.session && snap.session.cwd) }
      } catch (e) {
        return fail(e)
      }
    })
    harness.handle('canvas-source', async () => {
      if (fs === undefined) return { ok: false, error: 'fs service unavailable' }
      const tried = []
      for (let i = 0; i < UI_SRC_CANDIDATES.length; i++) {
        const want = UI_SRC_CANDIDATES[i]
        try {
          const target = await fs.resolve(want)
          const src = await fs.readText(target)
          if (typeof src === 'string' && src.length > 0) {
            return { ok: true, src: src, bytes: src.length, path: want }
          }
          tried.push(want + ': empty')
        } catch (e) {
          tried.push(want + ': ' + String((e && e.message) || e))
        }
      }
      return { ok: false, error: 'UI source not found. tried -> ' + tried.join(' | ') }
    })
    harness.handle('canvas-read-text', async (args) => {
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
    harness.handle('canvas-export-file', async (args) => {
      if (fs === undefined) return { ok: false, error: 'fs service unavailable' }
      if (!args || typeof args.path !== 'string' || typeof args.content !== 'string') {
        return { ok: false, error: 'path and content required' }
      }
      try {
        const target = await fs.resolve(args.path)
        const outcome = await fs.writeText(target, args.content)
        return { ok: true, path: args.path, operation: outcome && outcome.operation ? String(outcome.operation) : null }
      } catch (e) {
        return fail(e)
      }
    })
    harness.handle('canvas-send-prompt', async (args) => {
      if (sessionController === undefined) return { ok: false, error: 'sessionController service unavailable' }
      try {
        if (!args || typeof args.sessionId !== 'string' || typeof args.text !== 'string') {
          return { ok: false, error: 'sessionId and text required' }
        }
        reqSeq += 1
        const value = await sessionController.prompt(
          {
            requestId: 'canvas-' + String(reqSeq),
            sessionId: args.sessionId,
            mode: args.mode === 'steer' ? 'steer' : 'queue',
            content: [{ type: 'text', text: args.text }],
          },
          abortShim(),
        )
        return { ok: !!(value && value.accepted === true) }
      } catch (e) {
        return fail(e)
      }
    })
  },
}
