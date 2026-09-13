#!/usr/bin/env node
/**
 * Pre-flight validation for the two Cordis package halves.
 *
 * src/host.js and src/client.js are plain function bodies handed to cordis_define
 * as code.host / code.client, so they are evaluated with the same new-Function
 * check the Cordis evaluator performs. Nothing here can install or activate the
 * plugin: a dynamic Cordis package only comes alive inside a live DSH process.
 *
 * Usage:  node scripts/check.mjs [--json]
 * Exit:   0 when there are no errors, 1 otherwise. Warnings never fail the run.
 */
import { readFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const HALVES = { host: 'src/host.js', client: 'src/client.js' }
// The plugin halves must never contain a template literal (the evaluator gives
// them no extra context), so the stripper only needs to know about it to be
// correct. Written as a code point to keep this file itself backtick-free.
const BACKTICK = String.fromCharCode(96)

// Constructs the Cordis evaluator forbids. From the cordis-plugin-development
// skill: do not use import, require, TypeScript types, as, decorators, or JSX;
// client React code must use React.createElement(...).
const HARD = [
  ['import statement', /(^|[^.\w])import\s+/],
  ['dynamic import()', /\bimport\s*\(/],
  ['require()', /\brequire\s*\(/],
  ['export statement', /(^|[^.\w])export\s+/],
  ['TypeScript enum', /\benum\b/],
  ['TypeScript interface', /\binterface\b/],
  ['TypeScript as-cast', /\bas\s+[A-Za-z_$][\w$]*\b/],
  ['JSX element', /(<\/?)([A-Za-z][\w.]*)(\s|\/|>)/],
]

// Off-guidance rather than forbidden. The skill discourages guessing at window /
// document / native timers / fetch, and warns against JSON.stringify or
// structuredClone on DSH live objects. Reported, not fatal.
const SOFT = [
  ['window.', /\bwindow\./],
  ['document.', /\bdocument\./],
  ['native setTimeout', /\bsetTimeout\s*\(/],
  ['native setInterval', /\bsetInterval\s*\(/],
  ['fetch(', /\bfetch\s*\(/],
  ['JSON.stringify (live data)', /JSON\.stringify/],
  ['structuredClone (live data)', /structuredClone/],
  ['eval(', /\beval\s*\(/],
  ['innerHTML', /innerHTML/],
  ['localStorage', /localStorage/],
]

// A '/' is a regex literal opener only where a value is expected. After a value
// (identifier, number, closing paren/bracket, string) it is division.
const KEYWORD_ENDS = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'do', 'else', 'yield', 'await', 'case'])
function slashOpensRegex(src, i, lastSig) {
  if (lastSig === '') return true
  if (!/[A-Za-z0-9_$)}\]]/.test(lastSig)) return true
  if (/[A-Za-z_$]/.test(lastSig)) {
    let k = i - 1
    while (k >= 0 && /[A-Za-z0-9_$]/.test(src[k])) k--
    if (KEYWORD_ENDS.has(src.slice(k + 1, i))) return true
  }
  return false
}

// Blank out string literals, regex literals and comments, preserving offsets and
// newlines so line numbers still line up. Without this, English prose inside a
// string ("files appear as nodes") trips the as-cast rule, and a quote that
// lives inside a regex character class trips the string scanner.
function stripLiterals(src) {
  const out = new Array(src.length).fill(' ')
  let i = 0
  let state = 'code'
  let lastSig = ''
  while (i < src.length) {
    const c = src[i]
    const n = i + 1 < src.length ? src[i + 1] : ''
    if (c === '\n') out[i] = '\n'
    if (state === 'code') {
      if (c === '\u0027') { state = 'sq'; i += 1; continue }
      if (c === '\u0022') { state = 'dq'; i += 1; continue }
      if (c === BACKTICK) { state = 'tpl'; i += 1; continue }
      if (c === '/' && n === '/') { state = 'line'; i += 1; continue }
      if (c === '/' && n === '*') { state = 'block'; i += 1; continue }
      if (c === '/' && slashOpensRegex(src, i, lastSig)) { state = 'regex'; i += 1; continue }
      out[i] = c
      if (c !== ' ' && c !== '\t' && c !== '\n') lastSig = c
      i += 1
      continue
    }
    if (state === 'line') { if (c === '\n') state = 'code'; i += 1; continue }
    if (state === 'block') { if (c === '*' && n === '/') { state = 'code'; i += 2; continue } i += 1; continue }
    if (state === 'regex') {
      if (c === '\\') { i += 2; continue }
      if (c === '[') { state = 'regexclass'; i += 1; continue }
      if (c === '/') { state = 'regexflags'; i += 1; continue }
      i += 1
      continue
    }
    if (state === 'regexclass') {
      if (c === '\\') { i += 2; continue }
      if (c === ']') { state = 'regex'; i += 1; continue }
      i += 1
      continue
    }
    if (state === 'regexflags') {
      if (c !== 'g' && c !== 'i' && c !== 'm' && c !== 's' && c !== 'u' && c !== 'y') state = 'code'
      i += 1
      continue
    }
    if (c === '\\') { i += 2; continue }
    const closes = (state === 'sq' && c === '\u0027') || (state === 'dq' && c === '\u0022') || (state === 'tpl' && c === BACKTICK)
    if (closes) { state = 'code'; lastSig = 'Z' }
    i += 1
  }
  return out.join('')
}

export function validate(root) {
  const errors = []
  const warnings = []
  const stats = {}
  const halves = {}

  for (const [name, rel] of Object.entries(HALVES)) {
    const abs = join(root, rel)
    if (!existsSync(abs)) { errors.push(name + ': ' + rel + ' is missing'); continue }
    const src = readFileSync(abs, 'utf8')
    halves[name] = src
    let parses = true
    let parseErr = null
    try { new Function(src) } catch (e) { parses = false; parseErr = e.message }
    if (!parses) errors.push(name + ': does not parse as a function body: ' + parseErr)
    const code = stripLiterals(src)
    for (const [why, re] of HARD) {
      if (re.test(code)) errors.push(name + ': ' + why + ' found - not allowed in a Cordis package body')
    }
    for (const [why, re] of SOFT) {
      if (re.test(code)) warnings.push(name + ': ' + why + ' used - off-guidance, prefer a Cordis service')
    }
    stats[name] = {
      file: rel,
      chars: src.length,
      lines: src.split('\n').length,
      sha256: createHash('sha256').update(src).digest('hex'),
      parses: parses,
    }
  }

  // The Client -> Host JSON RPC surface must line up in both directions.
  const uniq = (xs) => [...new Set(xs)].sort()
  const handlers = halves.host ? uniq([...halves.host.matchAll(/harness\.handle\(\s*'([^']+)'/g)].map((m) => m[1])) : []
  const callers = halves.client ? uniq([...halves.client.matchAll(/hostCall\(\s*'([^']+)'/g)].map((m) => m[1])) : []
  for (const method of callers) {
    if (!handlers.includes(method)) errors.push('client calls host RPC "' + method + '" but host.js registers no handler')
  }
  for (const method of handlers) {
    if (!callers.includes(method)) warnings.push('host registers "' + method + '" but the client never calls it')
  }

  return { ok: errors.length === 0, stats, rpc: { handlers, callers }, errors, warnings }
}

function main() {
  const asJson = process.argv.includes('--json')
  const result = validate(ROOT)

  if (asJson) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    for (const [name, s] of Object.entries(result.stats)) {
      console.log(
        name + '.js  ' + s.lines + ' lines, ' + s.chars + ' chars, ' +
        'sha256 ' + s.sha256.slice(0, 12) + '...  parse: ' + (s.parses ? 'ok' : 'FAIL'),
      )
    }
    console.log('')
    console.log('host RPC handlers  : ' + result.rpc.handlers.join(', '))
    console.log('client hostCall    : ' + result.rpc.callers.join(', '))
    for (const w of result.warnings) console.log('warn  ' + w)
    for (const e of result.errors) console.log('error ' + e)
    console.log('')
    console.log(result.ok ? 'check passed' : 'check FAILED (' + result.errors.length + ' error(s))')
  }

  process.exitCode = result.ok ? 0 : 1
}

// CLI only when executed directly; importing this module (install.mjs) must not
// print the report or set process.exitCode.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
