#!/usr/bin/env node
// ============================================================================
// Pre-flight gate for the Session Canvas dynamic Cordis package.
//
// It answers one question: "would cordis_define accept this, and do the two
// halves agree on their RPC surface?" It does NOT prove behaviour — that is
// scripts/selftest.mjs.
//
// Checks, per half:
//   1. parse      — the file must evaluate as a function body (`new Function`),
//                   which is exactly what the Cordis evaluator does.
//   2. load       — calling it with stub globals must return an object with an
//                   `apply` function (a Cordis Plugin).
//   3. banned     — no import / require / export / TS type syntax / JSX, the
//                   constructs the dynamic evaluator forbids.
//   4. warnings   — off-guidance globals (unguarded platform access, native
//                   timers, innerHTML) reported without failing.
//   5. RPC match  — every client `hostCall('sc-…')` has a host `harness.handle`,
//                   and every handler is called by the client.
//
// Exit 0 = no errors. Warnings never fail the run.
// Usage: node scripts/check.mjs [--json]
// ============================================================================

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const AS_JSON = process.argv.includes('--json')

const results = []
function record(half, name, pass, detail) {
  results.push({ half, name, pass, detail: detail === undefined ? null : String(detail) })
  return pass
}

// ---------------------------------------------------------------------------
// Source blanking: replace comments, string literals, template literals and
// regex literals with spaces while preserving newlines, so a rule can never
// trip on prose inside a string. Offsets stay aligned for diagnostics.
// ---------------------------------------------------------------------------
function blankSource(src) {
  let out = ''
  let i = 0
  const n = src.length
  let prev = ''
  const regexAllowed = (p) => p === '' || '(,=:[!&|?{};+-*%~^<>'.indexOf(p) >= 0
  while (i < n) {
    const c = src[i]
    const c2 = i + 1 < n ? src[i + 1] : ''
    if (c === '/' && c2 === '/') {
      while (i < n && src[i] !== '\n') { out += ' '; i += 1 }
      continue
    }
    if (c === '/' && c2 === '*') {
      out += '  '
      i += 2
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { out += src[i] === '\n' ? '\n' : ' '; i += 1 }
      if (i < n) { out += '  '; i += 2 }
      continue
    }
    if (c === "'" || c === '"') {
      const q = c
      out += ' '
      i += 1
      while (i < n) {
        const d = src[i]
        if (d === '\\') { out += '  '; i += 2; continue }
        if (d === q) { out += ' '; i += 1; break }
        out += d === '\n' ? '\n' : ' '
        i += 1
      }
      prev = q
      continue
    }
    if (c === '`') {
      out += ' '
      i += 1
      while (i < n) {
        const d = src[i]
        if (d === '\\') { out += '  '; i += 2; continue }
        if (d === '`') { out += ' '; i += 1; break }
        out += d === '\n' ? '\n' : ' '
        i += 1
      }
      prev = '`'
      continue
    }
    if (c === '/' && regexAllowed(prev)) {
      out += ' '
      i += 1
      let inClass = false
      let closed = false
      while (i < n) {
        const d = src[i]
        if (d === '\\') { out += '  '; i += 2; continue }
        if (d === '\n') break
        if (d === '[') inClass = true
        else if (d === ']') inClass = false
        else if (d === '/' && !inClass) { out += ' '; i += 1; closed = true; break }
        out += ' '
        i += 1
      }
      if (closed) {
        while (i < n && /[a-z]/.test(src[i])) { out += ' '; i += 1 }
      }
      prev = '/'
      continue
    }
    out += c
    if (!/\s/.test(c)) prev = c
    i += 1
  }
  return out
}

function lineOf(src, index) {
  let line = 1
  for (let i = 0; i < index && i < src.length; i++) if (src[i] === '\n') line += 1
  return line
}

const BANNED = [
  { name: 'import statement', re: /(^|[^.\w$])import\s*[({'"`]/m },
  { name: 'dynamic import()', re: /(^|[^.\w$])import\s*\(/m },
  { name: 'require()', re: /(^|[^.\w$])require\s*\(/m },
  { name: 'export statement', re: /(^|[^.\w$])export\s+(default|const|let|var|function|class|\{)/m },
  { name: 'TypeScript interface/enum', re: /(^|[^.\w$])(interface|enum)\s+[A-Za-z_$]/m },
  { name: 'TypeScript as-cast', re: /\bas\s+[A-Za-z_$][\w$.<>[\]]*/m },
  { name: 'JSX element', re: /<\/?(div|span|button|input|textarea|select|option|svg|path|circle|b|i|p|a|h1|h2|ul|li|table|tr|td)\b[\s/>]/m },
]

const WARN = [
  { name: 'window access', re: /(^|[^.\w$])window\s*[.[]/m },
  { name: 'document access', re: /(^|[^.\w$])document\s*[.[]/m },
  { name: 'localStorage access', re: /(^|[^.\w$])localStorage\s*[.[]/m },
  { name: 'native timer', re: /(^|[^.\w$])(setTimeout|setInterval)\s*\(/m },
  { name: 'fetch()', re: /(^|[^.\w$])fetch\s*\(/m },
  { name: 'innerHTML', re: /\.innerHTML\s*=/m },
  { name: 'eval()', re: /(^|[^.\w$])eval\s*\(/m },
]

function firstMatch(blanked, re) {
  const m = re.exec(blanked)
  if (!m) return null
  const idx = m.index + (m[1] ? m[1].length : 0)
  return { line: lineOf(blanked, idx), text: m[0].trim() }
}

// ---------------------------------------------------------------------------
// Stub globals so each half can actually be loaded, like the evaluator does.
// ---------------------------------------------------------------------------
function makeHostEnv() {
  const handlers = {}
  const harness = { handle: (name, fn) => { handlers[name] = fn } }
  const ctx = { get: () => undefined }
  return { globals: { harness, console: { log() {}, error() {} } }, ctx, handlers }
}

function makeClientEnv() {
  const registrations = []
  const slots = {
    inject: (name, fn) => { registrations.push(name); fn() },
    register: (spec, component) => ({ spec, component }),
  }
  const ctx = {
    get: (name) => (name === 'slots' ? slots : undefined),
    effect: (fn) => { fn() },
  }
  const React = {
    createElement: () => null,
    useState: (v) => [v, () => {}],
    useEffect: () => {},
    useMemo: (fn) => fn(),
    useRef: (v) => ({ current: v === undefined ? null : v }),
  }
  const styles = { insert: () => {} }
  const host = { call: async () => ({ ok: true }) }
  return { globals: { React, styles, host, console: { log() {}, error() {} } }, ctx, registrations }
}

// The dynamic evaluator hands each half a fixed set of names as function
// parameters (host: `harness`, `console`; client: `React`, `styles`, `host`,
// `console`). Injecting them the same way is what makes this load check stand
// in for the real evaluator instead of merely parsing the file.
const GLOBAL_NAMES = ['React', 'styles', 'host', 'harness', 'console']

function loadHalf(kind, src) {
  let fn
  try {
    fn = new Function(...GLOBAL_NAMES, src)
  } catch (e) {
    return { ok: false, error: 'parse: ' + String((e && e.message) || e) }
  }
  const env = kind === 'host' ? makeHostEnv() : makeClientEnv()
  const args = GLOBAL_NAMES.map((name) => env.globals[name])
  let plugin
  try {
    plugin = fn(...args)
  } catch (e) {
    return { ok: false, error: 'load: ' + String((e && e.message) || e) }
  }
  if (!plugin || typeof plugin.apply !== 'function') {
    return { ok: false, error: 'load: did not return a Cordis Plugin (missing apply)' }
  }
  try {
    plugin.apply(env.ctx)
  } catch (e) {
    return { ok: false, error: 'apply: ' + String((e && e.message) || e) }
  }
  return { ok: true, env }
}

// ---------------------------------------------------------------------------
function run() {
  const files = { host: path.join(ROOT, 'src', 'host.js'), client: path.join(ROOT, 'src', 'client.js') }
  const sources = {}
  const blanked = {}
  const envs = {}

  for (const half of ['host', 'client']) {
    const file = files[half]
    if (!fs.existsSync(file)) {
      record(half, 'file exists', false, file)
      continue
    }
    const src = fs.readFileSync(file, 'utf8')
    sources[half] = src
    blanked[half] = blankSource(src)
    record(half, 'file exists', true, file)
    record(half, 'has content', src.trim().length > 0, src.length + ' bytes')

    const loaded = loadHalf(half, src)
    record(half, 'evaluates and loads', loaded.ok, loaded.ok ? 'returns a Cordis Plugin with apply()' : loaded.error)
    if (loaded.ok) envs[half] = loaded.env

    let banned = 0
    for (const rule of BANNED) {
      const hit = firstMatch(blanked[half], rule.re)
      if (hit !== null) {
        banned += 1
        record(half, 'bans ' + rule.name, false, 'line ' + String(hit.line) + ': ' + hit.text)
      }
    }
    if (banned === 0) record(half, 'bans forbidden constructs', true, 'import/require/export/TS/JSX absent')

    const warned = []
    for (const rule of WARN) {
      const hit = firstMatch(blanked[half], rule.re)
      if (hit !== null) warned.push(rule.name + ' @' + String(hit.line))
    }
    record(half, 'platform access warnings', warned.length === 0, warned.length === 0 ? 'none' : warned.join(', '))
  }

  // -- RPC reconciliation ---------------------------------------------------
  const hostHandlers = new Set()
  const clientCalls = new Set()
  if (sources.host) {
    const re = /harness\.handle\(\s*'([^']+)'/g
    let m
    while ((m = re.exec(sources.host)) !== null) hostHandlers.add(m[1])
  }
  if (sources.client) {
    const re = /(?:hostCall|host\.call)\(\s*'([^']+)'/g
    let m
    while ((m = re.exec(sources.client)) !== null) clientCalls.add(m[1])
  }
  record('cross', 'host registers RPC handlers', hostHandlers.size > 0, Array.from(hostHandlers).sort().join(', '))
  record('cross', 'client calls RPC handlers', clientCalls.size > 0, Array.from(clientCalls).sort().join(', '))
  const missing = Array.from(clientCalls).filter((name) => !hostHandlers.has(name))
  record('cross', 'every client call has a host handler', missing.length === 0, missing.length === 0 ? 'all matched' : 'missing: ' + missing.join(', '))
  const unused = Array.from(hostHandlers).filter((name) => !clientCalls.has(name))
  record('cross', 'every host handler is called by the client', unused.length === 0, unused.length === 0 ? 'all used' : 'unused (warning only): ' + unused.join(', '))

  // -- build stamp agreement -------------------------------------------------
  if (sources.host && sources.client) {
    const hostBuild = /const BUILD = '([^']+)'/.exec(sources.host)
    const clientBuild = /const STAMP = '([^']+)'/.exec(sources.client)
    const same = hostBuild !== null && clientBuild !== null && hostBuild[1] === clientBuild[1]
    record('cross', 'both halves carry the same build stamp', same,
      same ? hostBuild[1] : 'host=' + (hostBuild ? hostBuild[1] : '?') + ' client=' + (clientBuild ? clientBuild[1] : '?'))
  }

  // -- registration invariants ---------------------------------------------
  if (sources.client) {
    const registersMain = /slots\.register\(\s*\{\s*name:\s*'main'/.test(sources.client)
    const registersSidebar = /slots\.register\(\s*\{\s*name:\s*'sidebar\.panellist'/.test(sources.client)
    record('client', 'registers a main panel', registersMain, 'slots.register({ name: \'main\' })')
    record('client', 'registers a sidebar entry', registersSidebar, 'slots.register({ name: \'sidebar.panellist\' })')
    const samePanel = /const PANEL_ID = '([^']+)'/.exec(sources.client)
    record('client', 'panel id is a single constant', samePanel !== null, samePanel ? samePanel[1] : 'PANEL_ID not found')
    record('client', 'inserts its stylesheet via ctx.effect', /ctx\.effect\(/.test(sources.client), 'ctx.effect(...)')
    const timerOnly = !/(^|[^.\w$])(setTimeout|setInterval)\s*\(/.test(blanked.client)
    record('client', 'uses the Cordis timer service', /ctx\.get\(\s*'timer'\s*\)/.test(sources.client) && timerOnly, "ctx.get('timer')")
  }
  if (sources.host) {
    record('host', 'tolerates absent services', /ctx\.get\(\s*'sessionQuery'\s*\)/.test(sources.host) && /sessionQuery === undefined/.test(blanked.host), 'ctx.get + undefined check')
    record('host', 'no filesystem access', !/ctx\.get\(\s*'fs'\s*\)/.test(sources.host), 'the topology needs no fs service')
  }

  const errors = results.filter((r) => !r.pass && !r.name.startsWith('every host handler') && !r.name.startsWith('platform access'))
  const warnings = results.filter((r) => !r.pass && (r.name.startsWith('every host handler') || r.name.startsWith('platform access')))
  return { errors, warnings, all: results }
}

const report = run()

if (AS_JSON) {
  console.log(JSON.stringify({
    ok: report.errors.length === 0,
    errors: report.errors.length,
    warnings: report.warnings.length,
    checks: report.all,
  }, null, 2))
} else {
  let lastHalf = null
  for (const r of report.all) {
    if (r.half !== lastHalf) {
      console.log('\n[' + r.half + ']')
      lastHalf = r.half
    }
    const mark = r.pass ? 'PASS' : (r.name.startsWith('every host handler') || r.name.startsWith('platform access') ? 'WARN' : 'FAIL')
    console.log('  ' + mark + '  ' + r.name + (r.detail ? '  — ' + r.detail : ''))
  }
  console.log('\n' + (report.errors.length === 0
    ? 'ALL PASS (' + String(report.all.length - report.warnings.length) + ' checks, ' + String(report.warnings.length) + ' warnings)'
    : 'FAILURES ' + String(report.errors.length)))
}

process.exit(report.errors.length === 0 ? 0 : 1)
