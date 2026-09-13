// ============================================================================
// Session Canvas — Host half.
//
// This file is the content of `code.host` for the cordis_define tool: a plain
// JavaScript function body returning a Cordis Plugin. It registers the Host RPC
// surface the Client half drives through `host.call(method, args)`.
//
// Rules this half obeys (they are also enforced by scripts/check.mjs):
//   * every handler answers an owned JSON value — never a live DSH object;
//   * every handler tolerates an absent Service (`ctx.get` + undefined check)
//     and reports it as `{ ok: false, error }` instead of throwing;
//   * nothing reads or writes the filesystem: the topology comes from the
//     session corpus alone, so there is no path to escape.
//
// The RPC surface (all methods are prefixed `sc-` to avoid colliding with any
// other dynamic package in the same process):
//
//   sc-info      -> service availability + limits, for the client's status line
//   sc-sessions  -> durable session headers (id / parentId / origin / cwd / live)
//   sc-titles    -> durable titles for a set of ids (separate: it is not cached)
//   sc-read      -> bounded transcript projection of one session
//   sc-prompt    -> admit one prompt into one ordinary session (queue | steer)
//   sc-cancel    -> cancel one live session's current turn, keeping its inbox
//   sc-fork      -> fork one session, which is how ordinary lineage is created
// ============================================================================

// Build stamp. It must equal STAMP in src/client.js — scripts/check.mjs enforces
// that — so the client can prove the two halves that are actually running in the
// process belong to the same iteration.
const BUILD = 'sc-1'

// sessionQuery.listSessions() reads the whole on-disk corpus, which costs
// hundreds of milliseconds of Host CPU. The topology polls faster than that, so
// the header list is cached. `force: true` bypasses it after a mutation.
const SESSION_CACHE_MS = 8000
const MAX_SESSIONS = 600
const MAX_TITLE_IDS = 150
// How far back into one session's log a transcript read looks. The read scans
// this many trailing events and keeps the last MAX_MESSAGES messages from them;
// `windowed` on the answer says whether older events exist beyond the scan.
const MAX_SCAN_EVENTS = 4000
const MAX_MESSAGES = 240
const MAX_PROMPT_CHARS = 20000

const str = (v) => (v === undefined || v === null ? null : String(v))

// Project one content-block array down to text. Whitespace-only text parts are
// skipped so a synthetic or empty block cannot turn into a blank transcript row.
const blocksText = (content) => {
  if (content === undefined || content === null) return ''
  const arr = Array.isArray(content) ? content : [content]
  const parts = []
  for (let i = 0; i < arr.length; i++) {
    const b = arr[i]
    if (!b || typeof b !== 'object') continue
    if (b.type === 'text' && typeof b.text === 'string' && b.text.trim().length > 0) parts.push(b.text)
    else if (b.type === 'image') parts.push('[image]')
    else if (b.type === 'tool-call') parts.push('[tool] ' + String(b.name || 'tool'))
    else if (b.type === 'tool-result') parts.push('[tool result]')
    else if (typeof b.type === 'string' && b.type !== 'text') parts.push('[' + b.type + ']')
  }
  return parts.join('\n')
}

const fail = (e) => ({ ok: false, error: String((e && e.message) || e || 'unknown error') })

// sessionController.prompt checks `signal.throwIfAborted()` once, at entry. The
// Cordis host does not hand a real AbortSignal to harness.handle callbacks, so a
// non-aborting shim is the honest argument here: cancellation of an admitted
// prompt is `sc-cancel` (agent.cancel), not this signal.
const abortShim = () => ({
  aborted: false,
  reason: undefined,
  onabort: null,
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() { return true },
  throwIfAborted() {},
})

return {
  apply(ctx) {
    const sessionQuery = ctx.get('sessionQuery')
    const sessionController = ctx.get('sessionController')
    let reqSeq = 0
    let headerCache = null
    let headerCacheAt = 0

    console.log('[session-canvas] host apply', {
      sessionQuery: sessionQuery !== undefined,
      sessionController: sessionController !== undefined,
    })

    async function headers(force) {
      const now = Date.now()
      if (force !== true && headerCache !== null && now - headerCacheAt < SESSION_CACHE_MS) {
        return headerCache
      }
      const value = await sessionQuery.listSessions()
      headerCache = Array.isArray(value) ? value : []
      headerCacheAt = Date.now()
      return headerCache
    }

    harness.handle('sc-info', async () => ({
      ok: true,
      build: BUILD,
      services: {
        sessionQuery: sessionQuery !== undefined,
        sessionController: sessionController !== undefined,
      },
      limits: {
        sessions: MAX_SESSIONS,
        titles: MAX_TITLE_IDS,
        events: MAX_SCAN_EVENTS,
        messages: MAX_MESSAGES,
        promptChars: MAX_PROMPT_CHARS,
        headerCacheMs: SESSION_CACHE_MS,
      },
    }))

    harness.handle('sc-sessions', async (args) => {
      if (sessionQuery === undefined) return { ok: false, error: 'sessionQuery service unavailable' }
      try {
        const all = await headers(args && args.force === true)
        const list = all.slice(0, MAX_SESSIONS)
        const items = []
        for (let i = 0; i < list.length; i++) {
          const rec = list[i]
          const header = rec && rec.header
          if (!header || header.id === undefined || header.id === null) continue
          items.push({
            id: String(header.id),
            parentId: str(header.parentSession),
            origin: str(header.origin),
            cwd: str(header.cwd),
            createdAt: typeof header.createdAt === 'number' ? header.createdAt : null,
            live: rec.live === true,
            persisted: rec.persisted === true,
          })
        }
        return {
          ok: true,
          items: items,
          total: all.length,
          truncated: all.length > list.length,
          scannedAt: headerCacheAt,
        }
      } catch (e) {
        return fail(e)
      }
    })

    harness.handle('sc-titles', async (args) => {
      if (sessionQuery === undefined) return { ok: false, error: 'sessionQuery service unavailable' }
      const wanted = []
      if (args && Array.isArray(args.ids)) {
        for (let i = 0; i < args.ids.length && wanted.length < MAX_TITLE_IDS; i++) {
          const id = args.ids[i]
          if (typeof id !== 'string' || id.length === 0) continue
          if (wanted.indexOf(id) >= 0) continue
          wanted.push(id)
        }
      }
      if (wanted.length === 0) return { ok: true, titles: {}, requested: 0 }
      try {
        const snaps = await sessionQuery.readTitleSnapshots(wanted)
        const arr = Array.isArray(snaps) ? snaps : []
        const titles = {}
        for (let i = 0; i < arr.length; i++) {
          const t = arr[i]
          if (!t || t.status !== 'fulfilled' || !t.value || !t.value.title) continue
          const text = t.value.title.title
          if (typeof text !== 'string' || text.length === 0) continue
          titles[String(t.sessionId)] = text
        }
        return { ok: true, titles: titles, requested: wanted.length }
      } catch (e) {
        return fail(e)
      }
    })

    harness.handle('sc-read', async (args) => {
      if (sessionQuery === undefined) return { ok: false, error: 'sessionQuery service unavailable' }
      if (!args || typeof args.sessionId !== 'string' || args.sessionId.length === 0) {
        return { ok: false, error: 'sessionId required' }
      }
      try {
        const snap = await sessionQuery.readSession(args.sessionId)
        const events = (snap && snap.events) || []
        const start = events.length > MAX_SCAN_EVENTS ? events.length - MAX_SCAN_EVENTS : 0
        const messages = []
        for (let i = start; i < events.length; i++) {
          const ev = events[i]
          if (!ev || typeof ev.type !== 'string') continue
          const data = ev.data || {}
          let role = null
          let text = ''
          if (ev.type === 'user/message') {
            role = 'user'
            text = blocksText(data.content)
          } else if (ev.type === 'assistant/message') {
            role = 'assistant'
            text = blocksText(data.message && data.message.content)
          } else if (ev.type === 'tool/call') {
            role = 'tool'
            text = String(data.name || 'tool')
          } else if (ev.type === 'system/message') {
            role = 'system'
            text = blocksText(data.message && data.message.content)
          } else {
            continue
          }
          if (text.length === 0) continue
          messages.push({ seq: Number(ev.seq) || 0, role: role, text: text })
        }
        const shown = messages.length > MAX_MESSAGES ? messages.slice(messages.length - MAX_MESSAGES) : messages
        return {
          ok: true,
          messages: shown,
          omitted: messages.length - shown.length,
          // True when the scan window itself cut the log short: `omitted` then
          // counts only what the message cap dropped inside that window, and
          // older history exists that this read never looked at.
          windowed: start > 0,
          events: events.length,
          cwd: str(snap && snap.session && snap.session.cwd),
        }
      } catch (e) {
        return fail(e)
      }
    })

    harness.handle('sc-prompt', async (args) => {
      if (sessionController === undefined) return { ok: false, error: 'sessionController service unavailable' }
      if (!args || typeof args.sessionId !== 'string' || args.sessionId.length === 0) {
        return { ok: false, error: 'sessionId required' }
      }
      const text = typeof args.text === 'string' ? args.text : ''
      if (text.trim().length === 0) return { ok: false, error: 'text must contain non-whitespace content' }
      if (text.length > MAX_PROMPT_CHARS) return { ok: false, error: 'text exceeds ' + String(MAX_PROMPT_CHARS) + ' characters' }
      try {
        reqSeq += 1
        const requestId = 'session-canvas-' + String(reqSeq)
        const value = await sessionController.prompt(
          {
            requestId: requestId,
            sessionId: args.sessionId,
            mode: args.mode === 'steer' ? 'steer' : 'queue',
            content: [{ type: 'text', text: text }],
          },
          abortShim(),
        )
        return { ok: !!(value && value.accepted === true), accepted: !!(value && value.accepted === true), requestId: requestId }
      } catch (e) {
        return fail(e)
      }
    })

    harness.handle('sc-cancel', async (args) => {
      if (sessionController === undefined) return { ok: false, error: 'sessionController service unavailable' }
      if (!args || typeof args.sessionId !== 'string' || args.sessionId.length === 0) {
        return { ok: false, error: 'sessionId required' }
      }
      try {
        const value = await sessionController.cancel({ sessionId: args.sessionId })
        return { ok: !!(value && value.accepted === true), accepted: !!(value && value.accepted === true) }
      } catch (e) {
        return fail(e)
      }
    })

    harness.handle('sc-fork', async (args) => {
      if (sessionController === undefined) return { ok: false, error: 'sessionController service unavailable' }
      if (!args || typeof args.sessionId !== 'string' || args.sessionId.length === 0) {
        return { ok: false, error: 'sessionId required' }
      }
      try {
        const value = await sessionController.fork({ sessionId: args.sessionId })
        return { ok: true, sessionId: str(value && value.sessionId) }
      } catch (e) {
        return fail(e)
      }
    })
  },
}
