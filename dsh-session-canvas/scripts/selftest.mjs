#!/usr/bin/env node
// ============================================================================
// Behavioural gate for the Session Canvas package.
//
// Two suites, both executing real code rather than pattern-matching source:
//
//   host   — src/host.js is evaluated as a function body against fabricated DSH
//            services shaped exactly like the ones its handlers read, then every
//            captured handler is called and its returned value asserted.
//   graph  — the module-scope helpers of src/client.js (everything before the
//            plugin return) are evaluated and `buildGraph` is driven with
//            synthetic session sets: lineage detection, filtering, the tidy
//            left-to-right layout, manual overrides and edge derivation.
//
// No DSH process, no Cordis runtime, nothing to approve.
// Usage: node scripts/selftest.mjs [--json]
// ============================================================================

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const AS_JSON = process.argv.includes('--json')

const results = []
function check(suite, name, cond, detail) {
  const pass = cond === true
  results.push({ suite, name, pass, detail: detail === undefined ? null : String(detail) })
  return pass
}
function eq(suite, name, actual, expected) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  return check(suite, name, a === e, a === e ? a : 'got ' + a + ', want ' + e)
}

const hostSrc = fs.readFileSync(path.join(ROOT, 'src', 'host.js'), 'utf8')
const clientSrc = fs.readFileSync(path.join(ROOT, 'src', 'client.js'), 'utf8')

// ===========================================================================
// Suite 1 — Host half behaviour
// ===========================================================================

const GLOBAL_NAMES = ['React', 'styles', 'host', 'harness', 'console']
const silentConsole = { log() {}, error() {} }

function loadHost(services) {
  const handlers = {}
  const harness = { handle: (name, fn) => { handlers[name] = fn } }
  const ctx = {
    get: (name) => (services && Object.prototype.hasOwnProperty.call(services, name) ? services[name] : undefined),
  }
  const fn = new Function(...GLOBAL_NAMES, hostSrc)
  const plugin = fn(undefined, undefined, undefined, harness, silentConsole)
  plugin.apply(ctx)
  return handlers
}

function record(id, opts) {
  const o = opts || {}
  return {
    header: {
      id: id,
      parentSession: o.parentId === undefined ? undefined : o.parentId,
      origin: o.origin === undefined ? undefined : o.origin,
      cwd: o.cwd === undefined ? '/tmp/ws' : o.cwd,
      createdAt: o.createdAt === undefined ? 1000 : o.createdAt,
    },
    live: o.live === true,
    persisted: true,
  }
}

function fakeQuery(records, opts) {
  const o = opts || {}
  const calls = { list: 0, titles: 0, read: 0 }
  return {
    calls,
    listSessions: async () => { calls.list += 1; return records },
    readTitleSnapshots: async (ids) => {
      calls.titles += 1
      return o.titles === undefined ? [] : o.titles(ids)
    },
    readSession: async (id) => {
      calls.read += 1
      return o.read === undefined ? { session: { cwd: '/tmp/ws' }, events: [] } : o.read(id)
    },
  }
}

function fakeController(behaviour) {
  const calls = { prompt: 0, cancel: 0, fork: 0 }
  const seen = { prompt: null, cancel: null, fork: null }
  return {
    calls,
    seen,
    prompt: async (request, signal) => {
      calls.prompt += 1
      seen.prompt = { request, signal }
      if (behaviour && behaviour.promptError) throw new Error(behaviour.promptError)
      return { accepted: true }
    },
    cancel: async (request) => {
      calls.cancel += 1
      seen.cancel = request
      if (behaviour && behaviour.cancelError) throw new Error(behaviour.cancelError)
      return { accepted: true }
    },
    fork: async (request) => {
      calls.fork += 1
      seen.fork = request
      if (behaviour && behaviour.forkError) throw new Error(behaviour.forkError)
      return { sessionId: 'session-child' }
    },
  }
}

async function hostSuite() {
  const S = 'host'

  // -- happy path -----------------------------------------------------------
  {
    const records = [
      record('session-a', { cwd: '/tmp/ws', live: true, createdAt: 1 }),
      record('session-b', { parentId: 'session-a', origin: 'subagent', createdAt: 2 }),
      record('session-c', { parentId: 'session-a', createdAt: 3 }),
    ]
    const query = fakeQuery(records, {
      titles: (ids) => ids.map((id, i) => (i === 0
        ? { sessionId: id, status: 'fulfilled', value: { title: { title: '标题 ' + id } } }
        : { sessionId: id, status: 'rejected', reason: 'none' })),
    })
    const controller = fakeController()
    const H = loadHost({ sessionQuery: query, sessionController: controller })

    const info = await H['sc-info']({})
    check(S, 'sc-info reports both services', info.ok === true && info.services.sessionQuery === true && info.services.sessionController === true)
    eq(S, 'sc-info publishes the session cap', info.limits.sessions, 600)
    eq(S, 'sc-info publishes the build stamp', info.build, 'sc-1')

    const list = await H['sc-sessions']({})
    eq(S, 'sc-sessions counts every record', list.total, 3)
    eq(S, 'sc-sessions does not claim truncation', list.truncated, false)
    eq(S, 'sc-sessions maps lineage fields', list.items[1], {
      id: 'session-b', parentId: 'session-a', origin: 'subagent', cwd: '/tmp/ws', createdAt: 2, live: false, persisted: true,
    })
    eq(S, 'sc-sessions keeps a live flag', list.items[0].live, true)

    await H['sc-sessions']({})
    eq(S, 'sc-sessions serves a second read from cache', query.calls.list, 1)
    await H['sc-sessions']({ force: true })
    eq(S, 'sc-sessions honors force to bypass cache', query.calls.list, 2)

    const titles = await H['sc-titles']({ ids: ['session-a', 'session-b'] })
    eq(S, 'sc-titles folds a fulfilled title', titles.titles['session-a'], '标题 session-a')
    eq(S, 'sc-titles drops a rejected title', titles.titles['session-b'], undefined)
    eq(S, 'sc-titles reports how many it asked for', titles.requested, 2)

    const none = await H['sc-titles']({ ids: [] })
    eq(S, 'sc-titles answers an empty request without a read', none.requested, 0)
    eq(S, 'sc-titles skips the service for an empty request', query.calls.titles, 1)

    const dup = await H['sc-titles']({ ids: ['x', 'x', 'y'] })
    eq(S, 'sc-titles deduplicates ids', dup.requested, 2)

    const many = []
    for (let i = 0; i < 200; i++) many.push('id-' + String(i))
    const capped = await H['sc-titles']({ ids: many })
    eq(S, 'sc-titles caps the batch', capped.requested, 150)

    const prompt = await H['sc-prompt']({ sessionId: 'session-a', text: 'hi', mode: 'steer' })
    eq(S, 'sc-prompt acknowledges acceptance', prompt.ok, true)
    eq(S, 'sc-prompt routes the requested mode', controller.seen.prompt.request.mode, 'steer')
    eq(S, 'sc-prompt carries the text as a content part', controller.seen.prompt.request.content, [{ type: 'text', text: 'hi' }])
    check(S, 'sc-prompt mints a request id', typeof prompt.requestId === 'string' && prompt.requestId.indexOf('session-canvas-') === 0, prompt.requestId)
    check(S, 'sc-prompt passes a signal with throwIfAborted', typeof controller.seen.prompt.signal.throwIfAborted === 'function')

    const cancel = await H['sc-cancel']({ sessionId: 'session-a' })
    eq(S, 'sc-cancel acknowledges', cancel.ok, true)
    eq(S, 'sc-cancel addresses the session', controller.seen.cancel, { sessionId: 'session-a' })

    const forked = await H['sc-fork']({ sessionId: 'session-a' })
    eq(S, 'sc-fork returns the child id', forked.sessionId, 'session-child')
  }

  // -- refuse bad input without touching the services -----------------------
  {
    const query = fakeQuery([])
    const controller = fakeController()
    const H = loadHost({ sessionQuery: query, sessionController: controller })

    const blank = await H['sc-prompt']({ sessionId: 'session-a', text: '   \n  ' })
    eq(S, 'sc-prompt rejects whitespace-only text', blank.ok, false)
    eq(S, 'sc-prompt does not call the controller for blank text', controller.calls.prompt, 0)

    const noId = await H['sc-prompt']({ text: 'hi' })
    eq(S, 'sc-prompt requires a session id', noId.ok, false)

    const huge = await H['sc-prompt']({ sessionId: 'session-a', text: 'x'.repeat(20001) })
    eq(S, 'sc-prompt rejects oversized text', huge.ok, false)
    eq(S, 'sc-prompt does not call the controller for oversized text', controller.calls.prompt, 0)

    const badRead = await H['sc-read']({})
    eq(S, 'sc-read requires a session id', badRead.ok, false)
  }

  // -- service failures surface as data, never as throws --------------------
  {
    const query = fakeQuery([], { read: () => { throw new Error('disk exploded') } })
    const controller = fakeController({ promptError: 'agent busy' })
    const H = loadHost({ sessionQuery: query, sessionController: controller })

    const failed = await H['sc-prompt']({ sessionId: 'session-a', text: 'hi' })
    eq(S, 'sc-prompt reports a service failure as data', failed.ok, false)
    check(S, 'sc-prompt carries the failure message', String(failed.error).indexOf('agent busy') >= 0, failed.error)

    const read = await H['sc-read']({ sessionId: 'session-a' })
    eq(S, 'sc-read reports a read failure as data', read.ok, false)
    check(S, 'sc-read carries the read failure message', String(read.error).indexOf('disk exploded') >= 0, read.error)

    const forkFail = loadHost({ sessionQuery: query, sessionController: fakeController({ forkError: 'fork failed' }) })
    const forked = await forkFail['sc-fork']({ sessionId: 'session-a' })
    eq(S, 'sc-fork reports a service failure as data', forked.ok, false)
    check(S, 'sc-fork carries the failure message', String(forked.error).indexOf('fork failed') >= 0, forked.error)
  }

  // -- absent services ------------------------------------------------------
  {
    const H = loadHost({})
    const info = await H['sc-info']({})
    eq(S, 'sc-info survives absent services', info.services, { sessionQuery: false, sessionController: false })
    for (const name of ['sc-sessions', 'sc-titles', 'sc-read']) {
      const r = await H[name]({ sessionId: 'x', ids: ['x'], force: false })
      eq(S, name + ' answers ok:false with no sessionQuery', r.ok, false)
    }
    for (const name of ['sc-prompt', 'sc-cancel', 'sc-fork']) {
      const r = await H[name]({ sessionId: 'x', text: 'hi' })
      eq(S, name + ' answers ok:false with no sessionController', r.ok, false)
    }
  }

  // -- projection shape -----------------------------------------------------
  {
    const events = []
    for (let i = 0; i < 300; i++) {
      events.push({ seq: i * 2, type: 'user/message', data: { content: [{ type: 'text', text: 'u' + String(i) }] } })
      events.push({ seq: i * 2 + 1, type: 'assistant/message', data: { message: { content: [{ type: 'text', text: 'a' + String(i) }] } } })
    }
    events.push({ seq: 9001, type: 'user/message', data: { content: [{ type: 'text', text: '   ' }] } })
    events.push({ seq: 9002, type: 'tool/call', data: { name: 'bash', arguments: '{}' } })
    events.push({ seq: 9003, type: 'assistant/attempt', data: { stream: [] } })
    const query = fakeQuery([], { read: () => ({ session: { cwd: '/tmp/ws' }, events }) })
    const H = loadHost({ sessionQuery: query })

    const r = await H['sc-read']({ sessionId: 'session-a' })
    eq(S, 'sc-read caps the message list', r.messages.length, 240)
    eq(S, 'sc-read reports how many it dropped', r.omitted, 361)
    eq(S, 'sc-read marks a read that covered the whole log', r.windowed, false)
    const roles = r.messages.map((m) => m.role)
    check(S, 'sc-read keeps both conversation roles', roles.indexOf('user') >= 0 && roles.indexOf('assistant') >= 0, roles.slice(0, 4).join(','))
    eq(S, 'sc-read ends on the newest surface event', r.messages[r.messages.length - 1], { seq: 9002, role: 'tool', text: 'bash' })
    check(S, 'sc-read projects a tool call', r.messages.some((m) => m.role === 'tool' && m.text === 'bash'), 'no tool row')
    check(S, 'sc-read ignores non-surface events', r.messages.some((m) => m.text === 'attempt') === false)
    check(S, 'sc-read reports the cwd', r.cwd === '/tmp/ws', r.cwd)

    const longEvents = []
    for (let i = 0; i < 5000; i++) longEvents.push({ seq: i, type: 'user/message', data: { content: [{ type: 'text', text: 'm' + String(i) }] } })
    const longRead = loadHost({ sessionQuery: fakeQuery([], { read: () => ({ session: {}, events: longEvents }) }) })
    const lr = await longRead['sc-read']({ sessionId: 'x' })
    eq(S, 'sc-read scans only the trailing window', lr.messages.length, 240)
    eq(S, 'sc-read flags a windowed read', lr.windowed, true)

    const empty = loadHost({ sessionQuery: fakeQuery([], { read: () => ({ session: {}, events: [{ seq: 1, type: 'user/message', data: { content: [{ type: 'text', text: '  ' }] } }] }) }) })
    const e = await empty['sc-read']({ sessionId: 'x' })
    eq(S, 'sc-read drops whitespace-only parts', e.messages.length, 0)
  }

  // -- returns are plain JSON, never live objects ---------------------------
  {
    const query = fakeQuery([record('session-a')], { titles: (ids) => ids.map((id) => ({ sessionId: id, status: 'fulfilled', value: { title: { title: 't' } } })) })
    const H = loadHost({ sessionQuery: query, sessionController: fakeController() })
    const answers = []
    answers.push(await H['sc-info']({}))
    answers.push(await H['sc-sessions']({}))
    answers.push(await H['sc-titles']({ ids: ['session-a'] }))
    let allJson = true
    for (const a of answers) {
      try {
        if (JSON.stringify(JSON.parse(JSON.stringify(a))) !== JSON.stringify(a)) allJson = false
      } catch (e) {
        allJson = false
      }
    }
    check(S, 'every handler answer is lossless JSON', allJson)
  }
}

// ===========================================================================
// Suite 2 — Client graph builder behaviour
// ===========================================================================

function loadGraphBuilder() {
  const marker = '\nreturn {'
  const cut = clientSrc.lastIndexOf(marker)
  if (cut < 0) throw new Error('client.js has no top-level plugin return')
  const moduleSrc = clientSrc.slice(0, cut)
  const React = { createElement: () => null }
  const fn = new Function('React', 'console', moduleSrc + '\nreturn { buildGraph: buildGraph, NODE_W: NODE_W, NODE_H: NODE_H, COL_GAP: COL_GAP }')
  return fn(React, silentConsole)
}

function session(id, parentId, origin, createdAt, cwd) {
  return { id: id, parentId: parentId === undefined ? null : parentId, origin: origin === undefined ? null : origin, cwd: cwd === undefined ? '/tmp/ws' : cwd, createdAt: createdAt === undefined ? 1 : createdAt, live: false, persisted: true }
}

const F = { q: '', ws: '__all__', showSub: true, onlyChildren: false }

function graphSuite() {
  const S = 'graph'
  const B = loadGraphBuilder()

  // -- lineage --------------------------------------------------------------
  {
    const items = [session('a', undefined, undefined, 1), session('b', 'a', 'subagent', 2), session('c', 'a', undefined, 3)]
    const g = B.buildGraph(items, {}, F, null)
    eq(S, 'one root, two descendants', g.nodes.length, 3)
    eq(S, 'roots sit at depth 0', g.nodeById['a'].depth, 0)
    eq(S, 'children sit at depth 1', [g.nodeById['b'].depth, g.nodeById['c'].depth], [1, 1])
    eq(S, 'a fork edge is labelled fork', g.edges.filter((e) => e.to === 'c').map((e) => e.kind), ['fork'])
    eq(S, 'a subagent edge is labelled sub', g.edges.filter((e) => e.to === 'b').map((e) => e.kind), ['sub'])
    eq(S, 'the subagent node is marked sub', g.nodeById['b'].kind, 'sub')
    eq(S, 'the root knows its child count', g.nodeById['a'].childCount, 2)
    eq(S, 'depth drives the x position', g.nodeById['b'].x, B.NODE_W + B.COL_GAP)
    eq(S, 'the root sits at the origin column', g.nodeById['a'].x, 0)
  }

  // -- layout: sibling leaves never overlap ---------------------------------
  {
    const items = [session('r', undefined, undefined, 1)]
    for (let i = 0; i < 5; i++) items.push(session('k' + String(i), 'r', 'subagent', 10 + i))
    const g = B.buildGraph(items, {}, F, null)
    const ys = g.nodes.filter((n) => n.depth === 1).map((n) => n.y).sort((x, y) => x - y)
    let ok = true
    for (let i = 1; i < ys.length; i++) if (ys[i] - ys[i - 1] < B.NODE_H) ok = false
    check(S, 'sibling leaves never overlap vertically', ok, ys.join(','))
    check(S, 'the parent is centred on its children', Math.abs(g.nodeById['r'].y - (ys[0] + ys[ys.length - 1]) / 2) < 0.001, g.nodeById['r'].y)
  }

  // -- a parent outside the visible set makes the child a root --------------
  {
    const g = B.buildGraph([session('orphan', 'missing-parent', 'subagent', 1)], {}, F, null)
    eq(S, 'an unknown parent leaves the child as a root', g.nodes.length, 1)
    eq(S, 'no edge is invented for an unknown parent', g.edges.length, 0)
    eq(S, 'the orphan keeps its subagent kind', g.nodeById['orphan'].kind, 'sub')
    eq(S, 'the orphan keeps its recorded parent', g.nodeById['orphan'].parentId, 'missing-parent')
  }

  // -- filters --------------------------------------------------------------
  {
    const items = [
      session('root', undefined, undefined, 1, '/tmp/one'),
      session('sub', 'root', 'subagent', 2, '/tmp/one'),
      session('other', undefined, undefined, 3, '/tmp/two'),
    ]
    const noSub = B.buildGraph(items, { sub: 'S' }, { q: '', ws: '__all__', showSub: false, onlyChildren: false }, null)
    eq(S, 'hiding subagents drops those nodes', noSub.nodes.map((n) => n.id).sort(), ['other', 'root'])

    const ws = B.buildGraph(items, {}, { q: '', ws: '/tmp/two', showSub: true, onlyChildren: false }, null)
    eq(S, 'the workspace filter keeps one directory', ws.nodes.map((n) => n.id), ['other'])

    const search = B.buildGraph(items, { sub: 'needle' }, { q: 'needle', ws: '__all__', showSub: true, onlyChildren: false }, null)
    eq(S, 'search matches a title', search.nodes.map((n) => n.id), ['sub'])

    const byId = B.buildGraph(items, {}, { q: 'other', ws: '__all__', showSub: true, onlyChildren: false }, null)
    eq(S, 'search matches an id', byId.nodes.map((n) => n.id), ['other'])

    const only = B.buildGraph([
      session('a', undefined, undefined, 1),
      session('b', 'a', undefined, 2),
      session('c', 'b', 'subagent', 3),
      session('lonely', undefined, undefined, 4),
    ], {}, { q: '', ws: '__all__', showSub: true, onlyChildren: true }, null)
    eq(S, 'only-branching keeps the branching spine', only.nodes.map((n) => n.id).sort(), ['a', 'b'])
    eq(S, 'only-branching drops a standalone root', only.nodes.some((n) => n.id === 'lonely'), false)
    eq(S, 'only-branching keeps the surviving link', only.edges.map((e) => e.from + '>' + e.to), ['a>b'])
  }

  // -- manual override ------------------------------------------------------
  {
    const items = [session('a', undefined, undefined, 1), session('b', 'a', undefined, 2)]
    const g = B.buildGraph(items, {}, F, { a: { x: 1000, y: 2000 } })
    eq(S, 'a manual position wins over the layout', [g.nodeById['a'].x, g.nodeById['a'].y], [1000, 2000])
    eq(S, 'edges follow the manual position', g.edges[0].x1, 1000 + B.NODE_W)
    const untouched = B.buildGraph(items, {}, F, { nope: { x: 5, y: 5 } })
    eq(S, 'a manual position for an unknown id is ignored', untouched.nodeById['a'].x, 0)
  }

  // -- invariants -----------------------------------------------------------
  {
    const items = [session('a', undefined, undefined, 1), session('b', 'a', 'subagent', 2), session('c', 'b', 'subagent', 3)]
    const one = B.buildGraph(items, { a: 'A' }, F, null)
    const two = B.buildGraph(items, { a: 'A' }, F, null)
    eq(S, 'the layout is deterministic', JSON.stringify(one), JSON.stringify(two))
    let refsOk = true
    for (const e of one.edges) if (one.nodeById[e.from] === undefined || one.nodeById[e.to] === undefined) refsOk = false
    check(S, 'every edge references a drawn node', refsOk)
    eq(S, 'every node appears exactly once', one.nodes.length, Object.keys(one.nodeById).length)
    eq(S, 'a deep chain keeps increasing depth', [one.nodeById['a'].depth, one.nodeById['b'].depth, one.nodeById['c'].depth], [0, 1, 2])
    eq(S, 'a grandchild hangs off its own parent', one.edges.map((e) => e.from + '>' + e.to), ['a>b', 'b>c'])
    check(S, 'maxX covers the widest node', one.maxX >= (2 * (B.NODE_W + B.COL_GAP)) + B.NODE_W - 0.001, one.maxX)
  }

  // -- empty input ----------------------------------------------------------
  {
    const g = B.buildGraph([], {}, F, null)
    eq(S, 'an empty corpus produces an empty graph', [g.nodes.length, g.edges.length, g.total], [0, 0, 0])
  }
}

await hostSuite()
graphSuite()

const failures = results.filter((r) => !r.pass)
if (AS_JSON) {
  console.log(JSON.stringify({ ok: failures.length === 0, failed: failures.length, checks: results }, null, 2))
} else {
  let lastSuite = null
  for (const r of results) {
    if (r.suite !== lastSuite) {
      console.log('\n[' + r.suite + ']')
      lastSuite = r.suite
    }
    console.log('  ' + (r.pass ? 'PASS' : 'FAIL') + '  ' + r.name + (r.detail && !r.pass ? '  — ' + r.detail : ''))
  }
  console.log('\n' + (failures.length === 0 ? 'ALL PASS (' + String(results.length) + ')' : 'FAILURES ' + String(failures.length)))
}
process.exit(failures.length === 0 ? 0 : 1)
