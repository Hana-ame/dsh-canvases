#!/usr/bin/env node
/**
 * Functional test for the two RPCs that had no verification path offline.
 *
 * check.mjs proves the package is hygienic; it cannot prove behaviour. This file
 * does the opposite: it evaluates src/host.js as a function body against a
 * harness the test controls, installs fake DSH services, and calls the captured
 * handlers directly. No DSH process, no Cordis runtime, nothing to approve.
 *
 * It covers the two things that were previously untestable:
 *   1. canvas-list-files takes agentId, so no path string can cross the
 *      RPC boundary.
 *   2. canvas-send-prompt passes a live AbortSignal that canvas-abort-request
 *      flips, and a co-operative callee is actually cancelled by it.
 *
 * Point 2 is the honest limit of what this can show: it proves the plugin's
 * signal behaves like a real AbortSignal when a callee checks it. Whether the
 * real sessionController.prompt inspects that signal during its own call is a
 * question about the DSH runtime, which is not present in this checkout.
 *
 * Usage:  node scripts/selftest.mjs [--json]
 * Exit:   0 when every check passes, 1 otherwise.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')
const sleep = (ms) => new Promise((res) => setTimeout(res, ms))

const results = []
function check(name, cond, detail) {
  results.push({ name: name, ok: !!cond, detail: cond ? undefined : detail })
  console.log((cond ? '  ok    ' : '  FAIL  ') + name + (cond ? '' : '   -> ' + JSON.stringify(detail)))
}

// --- evaluate the host half against a harness we own -----------------------
const handlers = {}
const harness = { handle: function (method, fn) { handlers[method] = fn } }

let hostModule = null
try {
  hostModule = new Function('harness', read('src/host.js'))(harness)
} catch (e) {
  console.log('FAIL  host.js does not evaluate as a function body: ' + e.message)
  process.exit(1)
}

// --- fake DSH services -----------------------------------------------------
// Shapes below are read from src/host.js, not guessed:
//   readTitleSnapshots -> [{ status, sessionId, value: { title: { title } } }]
//   readSession        -> { session: { cwd }, events: [{ seq, type, data }] }
//   create / fork      -> { sessionId }
const SESSIONS = [
  { header: { id: 's1', cwd: '/tmp/proj', createdAt: 1000, parentSession: null, origin: null }, live: true, persisted: true },
  { header: { id: 's2', createdAt: 2000, parentSession: null, origin: null }, live: true, persisted: false },
  { header: { id: 's3', cwd: null, createdAt: 3000, parentSession: 's1', origin: null }, live: false, persisted: true },
]
const TREE = {
  '/tmp/proj': [
    { name: 'a.txt', type: 'file', size: 10, target: { displayPath: '/tmp/proj/a.txt' } },
    { name: 'src', type: 'directory', size: null, target: { displayPath: '/tmp/proj/src' } },
    { name: 'node_modules', type: 'directory', size: null, target: { displayPath: '/tmp/proj/node_modules' } },
  ],
  '/tmp/proj/src': [
    { name: 'b.js', type: 'file', size: 20, target: { displayPath: '/tmp/proj/src/b.js' } },
  ],
}
const sessionQuery = {
  listSessions: async () => SESSIONS.slice(),
  readTitleSnapshots: async (ids) => ids.map((id) => ({
    status: 'fulfilled',
    sessionId: id,
    value: { title: { title: 'title-' + id } },
  })),
  readSession: async (id) => ({
    session: { cwd: id === 's1' ? '/tmp/proj' : null },
    events: [
      { seq: 1, type: 'user/message', data: { message: { content: [{ type: 'text', text: 'do the thing' }] } } },
      { seq: 2, type: 'assistant/message', data: { message: { content: [{ type: 'text', text: 'done' }] } } },
      { seq: 3, type: 'tool/call', data: { name: 'grep' } },
      { seq: 4, type: 'unknown/event', data: {} },
    ],
  }),
}
const fs = {
  resolve: async (p) => ({ displayPath: p }),
  listDir: async (t) => (TREE[String(t && t.displayPath)] || []).slice(),
}
const agentPresets = { list: async () => [{ id: 'p1', name: 'default' }] }

let cooperativeMode = false
let currentRequestId = null
let gate = null
const seenSignals = []
const sessionController = {
  create: async () => ({ sessionId: 'new-1', agentPreset: 'p1' }),
  fork: async () => ({ sessionId: 'new-2' }),
  prompt: async function (params, signal) {
    seenSignals.push(signal)
    currentRequestId = params.requestId
    if (cooperativeMode) {
      // The real co-operative pattern: register an abort listener so the
      // suspension can be escaped, then re-check before reporting success.
      if (signal && typeof signal.throwIfAborted === 'function') signal.throwIfAborted()
      await new Promise((resolve) => {
        gate = resolve
        if (signal && typeof signal.addEventListener === 'function') signal.addEventListener('abort', resolve)
      })
      if (signal && typeof signal.throwIfAborted === 'function') signal.throwIfAborted()
      return { accepted: true, reachedEnd: true }
    }
    await sleep(1)
    if (signal && signal.aborted === true) return { accepted: false, cancelled: true }
    return { accepted: true, requestId: params.requestId }
  },
}
const ctx = { get: function (name) { return { sessionQuery: sessionQuery, sessionController: sessionController, agentPresets: agentPresets, fs: fs }[name] } }

const origLog = console.log
console.log = function () {}
hostModule.apply(ctx)
console.log = origLog

for (const method of ['canvas-sessions', 'canvas-presets', 'canvas-list-files', 'canvas-send-prompt', 'canvas-abort-request', 'canvas-create-session', 'canvas-fork-session', 'canvas-read-session']) {
  check('host registers ' + method, typeof handlers[method] === 'function')
}

console.log('')
console.log('== canvas-list-files: agentId contract ==')

{
  const h = handlers['canvas-list-files']
  const r1 = await h({ agentId: 's1', maxDepth: 2, limit: 160 })
  check('resolves the agents own working directory', r1 && r1.ok === true && r1.root === '/tmp/proj', r1)
  check('walks the tree', r1 && Array.isArray(r1.entries) && r1.entries.length === 3, r1 && r1.entries)
  check('not truncated when uncapped', r1 && r1.truncated === false, r1 && r1.truncated)
  check('still prunes node_modules', r1 && !r1.entries.some((e) => e.name === 'node_modules'))
  check('still reports rel paths', r1 && r1.entries.every((e) => typeof e.rel === 'string' && e.rel.length > 0))

  const capped = await h({ agentId: 's1', maxDepth: 2, limit: 2 })
  check('flags truncated when capped', capped && capped.truncated === true, capped && capped.truncated)
  check('caps entry count at limit', capped && capped.entries.length === 2, capped && capped.entries.length)

  for (const [label, args] of [
    ['agent with no cwd field', { agentId: 's2' }],
    ['agent with null cwd', { agentId: 's3' }],
    ['unknown agent id', { agentId: 'does-not-exist' }],
  ]) {
    const r = await h(args)
    check(label, r && r.ok === false && r.error === 'agent has no working directory', r)
  }

  for (const [label, args] of [
    ['old {path} contract', { path: '/etc' }],
    ['empty args', {}],
    ['blank agentId', { agentId: '   ' }],
    ['numeric agentId', { agentId: 42 }],
    ['no args', null],
  ]) {
    const r = await h(args)
    check(label + ' -> agentId required', r && r.ok === false && r.error === 'agentId required', r)
  }

  const hostile = await h({ agentId: 's1', path: '/etc' })
  check('extra path field is ignored, agent cwd wins', hostile && hostile.ok === true && hostile.root === '/tmp/proj', hostile)
}

console.log('')
console.log('== canvas-send-prompt + canvas-abort-request ==')

{
  const send = handlers['canvas-send-prompt']
  const abort = handlers['canvas-abort-request']

  const r = await send({ sessionId: 's1', text: 'hello', mode: 'queue' })
  check('send returns ok', r && r.ok === true, r)
  check('send returns a requestId', typeof r.requestId === 'string' && r.requestId.length > 0, r)
  check('send reports aborted=false initially', r && r.aborted === false, r)
  check('prompt received a signal object', seenSignals.length === 1 && seenSignals[0] !== null, seenSignals.length)

  const sig = seenSignals[0]
  const desc = Object.getOwnPropertyDescriptor(sig, 'aborted')
  check('aborted is an accessor, not a data property', desc && typeof desc.get === 'function' && desc.set === undefined, desc)
  check('signal.aborted reads false while pending', sig.aborted === false, sig.aborted)
  check('throwIfAborted is callable', typeof sig.throwIfAborted === 'function')
  check('addEventListener is callable', typeof sig.addEventListener === 'function')

  let threw = null
  try { sig.throwIfAborted() } catch (e) { threw = e.message }
  check('throwIfAborted is silent while pending', threw === null, threw)

  const a1 = await abort({ requestId: r.requestId })
  check('abort returns ok', a1 && a1.ok === true, a1)
  check('abort flips signal.aborted', sig.aborted === true, sig.aborted)
  threw = null
  try { sig.throwIfAborted() } catch (e) { threw = e.message }
  check('throwIfAborted throws once aborted', threw === 'aborted', threw)
  check('abort is idempotent', (await abort({ requestId: r.requestId })).ok === true)

  for (const [label, args] of [
    ['bogus id', { requestId: 'canvas-999' }],
    ['empty id', { requestId: '' }],
    ['no requestId', {}],
    ['null args', null],
  ]) {
    const a = await abort(args)
    check(label + ' -> no such request', a && a.ok === false && a.error === 'no such request', a)
  }

  check('send-prompt still rejects bad input', (await send({ sessionId: 's1' })).error === 'sessionId and text required')
}

console.log('')
console.log('== does the signal actually cancel a co-operative callee? ==')

{
  const send = handlers['canvas-send-prompt']
  const abort = handlers['canvas-abort-request']
  cooperativeMode = true

  const pending = send({ sessionId: 's1', text: 'slow task', mode: 'queue' })
  await sleep(20)
  check('callee is suspended mid-flight', gate !== null && currentRequestId !== null, { suspended: gate !== null, id: currentRequestId })

  const a = await abort({ requestId: currentRequestId })
  check('abort reaches the running request', a && a.ok === true, a)

  const out = await pending
  check('co-operative callee was cancelled via throwIfAborted', out && out.ok === false && /aborted/.test(out.error), out)
  check('callee did not report success', !(out && out.ok === true), out)

  cooperativeMode = false
}

console.log('')
console.log('== regression: untouched handlers still work ==')

{
  const s = await handlers['canvas-sessions']({})
  check('canvas-sessions lists sessions', s && s.ok === true && Array.isArray(s.items) && s.items.length === 3, s)
  check('canvas-sessions carries cwd', s && s.items.some((i) => i.id === 's1' && i.cwd === '/tmp/proj'))
  check('canvas-sessions resolves titles', s && s.items.some((i) => i.id === 's1' && i.title === 'title-s1'), s && s.items[0])

  const p = await handlers['canvas-presets']({})
  check('canvas-presets lists presets', p && p.ok === true && p.items.length === 1, p)

  const created = await handlers['canvas-create-session']({ cwd: '/tmp/proj', agentPreset: 'p1' })
  check('canvas-create-session returns a session id', created && created.ok === true && created.sessionId === 'new-1', created)
  check('canvas-create-session echoes cwd', created && created.cwd === '/tmp/proj', created)
  check('canvas-create-session rejects missing service input', (await handlers['canvas-create-session'](null)).ok === true)

  const forked = await handlers['canvas-fork-session']({ sessionId: 's1' })
  check('canvas-fork-session returns a session id', forked && forked.ok === true && forked.sessionId === 'new-2', forked)
  check('canvas-fork-session rejects non-string id', (await handlers['canvas-fork-session']({ sessionId: 5 })).error === 'sessionId required')

  const rd = await handlers['canvas-read-session']({ sessionId: 's1' })
  check('canvas-read-session returns messages', rd && rd.ok === true && Array.isArray(rd.messages) && rd.messages.length === 3, rd)
  check('canvas-read-session folds message content', rd && rd.messages.some((m) => m.role === 'assistant' && m.text === 'done'), rd && rd.messages)
  check('canvas-read-session skips unknown event types', rd && rd.messages.length === 3, rd && rd.messages.length)
  check('canvas-read-session passes through cwd', rd && rd.cwd === '/tmp/proj', rd && rd.cwd)
  check('canvas-read-session rejects missing id', (await handlers['canvas-read-session']({})).error === 'sessionId required')
}

const failed = results.filter((r) => !r.ok)
if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ total: results.length, passed: results.length - failed.length, failed: failed.length, results: results }, null, 2))
} else {
  console.log('')
  console.log((results.length - failed.length) + '/' + results.length + ' checks passed')
  console.log(failed.length === 0 ? 'selftest passed' : 'selftest FAILED (' + failed.length + ' check(s))')
  for (const f of failed) console.log('  - ' + f.name)
}
process.exitCode = failed.length === 0 ? 0 : 1
