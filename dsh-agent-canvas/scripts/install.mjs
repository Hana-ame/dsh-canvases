#!/usr/bin/env node
/**
 * One-command installer for the agent-canvas Cordis plugin.
 *
 * A dynamic Cordis package only comes alive inside a live DSH process, so this
 * script cannot install anything by itself. What it does instead: it runs the
 * pre-flight checks, and it prints the thing you hand to your DSH agent - a
 * prompt that names the two package halves, their sha256 fingerprints, and the
 * two calls the agent then makes (cordis_define, then cordis_run).
 *
 * Modes
 *   node scripts/install.mjs           short prompt; the agent reads ./src from disk
 *   node scripts/install.mjs --prompt  self-contained prompt with both halves inline
 *   node scripts/install.mjs --json    machine-readable summary
 *
 * Options
 *   --host-only / --client-only   limit the emit to one half
 *
 * Exit 0 when the pre-flight passes, 1 when it does not, 2 on bad usage.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validate } from './check.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const NAME = 'agent-canvas'
const HOST = 'src/host.js'
const CLIENT = 'src/client.js'
const FENCE = String.fromCharCode(96) + String.fromCharCode(96) + String.fromCharCode(96)
const SQUOTE = String.fromCharCode(39)
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

const argv = process.argv.slice(2)
const flags = new Set(argv.filter((a) => a.indexOf('--') === 0))
const asJson = flags.has('--json')
const inline = flags.has('--prompt')
const hostOnly = flags.has('--host-only')
const clientOnly = flags.has('--client-only')

if (hostOnly && clientOnly) {
  console.error('--host-only and --client-only are mutually exclusive')
  process.exit(2)
}
const plainFlags = argv.filter((a) => a.indexOf('--') === 0 && a !== '--json' && a !== '--prompt' && a !== '--host-only' && a !== '--client-only')
if (!asJson && !inline && plainFlags.length > 0) {
  console.error('unrecognised flags: ' + plainFlags.join(' '))
  console.error('usage: node scripts/install.mjs [--json | --prompt] [--host-only | --client-only]')
  process.exit(2)
}

const result = validate(ROOT)
if (!result.ok) {
  console.error('Pre-flight failed; refusing to emit an install prompt.')
  for (const e of result.errors) console.error('  error  ' + e)
  for (const w of result.warnings) console.error('  warn   ' + w)
  console.error('')
  console.error('Fix the errors above and re-run "node scripts/install.mjs".')
  process.exit(1)
}

const hostSrc = clientOnly ? null : read(HOST)
const clientSrc = hostOnly ? null : read(CLIENT)
const picked = [HOST, CLIENT].filter((rel) => (rel === HOST ? hostSrc !== null : clientSrc !== null))
const totalChars = picked.reduce((n, rel) => n + read(rel).length, 0)

function linesFor(rel) {
  return read(rel).split('\n').length
}

function fingerprint(rel) {
  const key = rel === HOST ? 'host' : 'client'
  return result.stats[key].sha256.slice(0, 12)
}

function shaFor(rel) {
  return rel === HOST ? result.stats.host.sha256 : result.stats.client.sha256
}

function prose() {
  const out = []
  out.push('Install the Cordis plugin "' + NAME + '" from this repository.')
  out.push('')
  out.push('Package halves (both are plain JavaScript function bodies: no import, require, TS):')
  if (hostSrc !== null) out.push('  code.host    ' + HOST + '   ' + linesFor(HOST) + ' lines   sha256 ' + fingerprint(HOST) + '...')
  if (clientSrc !== null) out.push('  code.client  ' + CLIENT + '   ' + linesFor(CLIENT) + ' lines   sha256 ' + fingerprint(CLIENT) + '...')
  out.push('')
  out.push('Follow the cordis-plugin-development skill for the exact cordis_define argument')
  out.push('shape of this runtime version, embed the two files as code.host / code.client,')
  out.push('then activate with cordis_run. Argument names are runtime-version dependent and')
  out.push('deliberately not pinned here.')
  out.push('')
  out.push('What to expect:')
  out.push('- The client half registers slots main (id ' + NAME + '), sidebar.panellist, and')
  out.push('  tool.view.cordis with key ' + SQUOTE + 'self' + SQUOTE + '. A client package returns')
  out.push('  awaiting-approval; it needs your approval and a browser page refresh before the')
  out.push('  slot appears. Do not wait for that inside a single turn.')
  out.push('- The host half declares no hard inject. It probes sessionQuery,')
  out.push('  sessionController, agentPresets and fs via ctx.get and degrades per handler when')
  out.push('  one is missing, so a partial runtime still yields a partial canvas.')
  out.push('- Traffic between the halves is ' + result.rpc.handlers.length + ' package-private RPC methods,')
  out.push('  all wired on both sides: ' + result.rpc.handlers.join(', ') + '.')
  out.push('- Pre-flight passed: both halves parse as function bodies, no banned constructs.')
  if (result.warnings.length) out.push('- Known warnings: ' + result.warnings.join('; ') + '.')
  out.push('')
  out.push('Limits in the code that install does not fix:')
  out.push('- canvas-send-prompt passes a fake AbortSignal, so a host-side prompt cannot be')
  out.push('  cancelled once queued.')
  out.push('- canvas-list-files takes an arbitrary path with no workspace confinement.')
  return out.join('\n')
}

function inlineBlocks() {
  const out = []
  out.push('')
  out.push('The two halves, verbatim:')
  if (hostSrc !== null) {
    out.push('')
    out.push(FENCE + 'js')
    out.push('// ' + HOST + '  ->  code.host')
    out.push(hostSrc)
    out.push(FENCE)
  }
  if (clientSrc !== null) {
    out.push('')
    out.push(FENCE + 'js')
    out.push('// ' + CLIENT + '  ->  code.client')
    out.push(clientSrc)
    out.push(FENCE)
  }
  return out.join('\n')
}

if (asJson) {
  console.log(JSON.stringify({
    plugin: NAME,
    files: picked.map((rel) => ({
      rel: rel,
      role: rel === HOST ? 'code.host' : 'code.client',
      lines: linesFor(rel),
      chars: read(rel).length,
      sha256: shaFor(rel),
    })),
    totalChars: totalChars,
    rpc: result.rpc,
    checks: { errors: result.errors, warnings: result.warnings },
    notes: [
      'Client activation returns awaiting-approval and needs a page refresh.',
      'Follow the cordis-plugin-development skill for the cordis_define argument shape.',
      'canvas-send-prompt cannot be cancelled (fake AbortSignal).',
      'canvas-list-files is not confined to a workspace.',
    ],
  }, null, 2))
} else {
  console.log('=== ' + NAME + ' install prompt ===')
  console.log('')
  console.log(prose())
  if (inline) {
    console.log(inlineBlocks())
  } else {
    console.log('')
    console.log('The agent reads the files itself from ' + ROOT + '. For a')
    console.log('self-contained prompt with both halves inline (' + totalChars + ' chars), run:')
    console.log('')
    console.log('  node scripts/install.mjs --prompt')
  }
  console.log('')
  console.log('=== end ' + NAME + ' install prompt ===')
}
