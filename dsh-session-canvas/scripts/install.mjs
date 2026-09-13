#!/usr/bin/env node
// ============================================================================
// Emit the cordis_define payload for the Session Canvas dynamic package.
//
// A dynamic Cordis package only exists inside a running DSH process, so it
// cannot be installed from the shell. What the shell can do is:
//   1. refuse to emit anything while the pre-flight gate fails;
//   2. fingerprint both halves so the definition in the process can be matched
//      against these files afterwards;
//   3. print the exact `cordis_define` argument, either as a paste-ready prompt
//      (--prompt, self-contained) or as a short pointer at ./src (default).
//
// Usage:
//   node scripts/install.mjs            short prompt; the agent reads ./src
//   node scripts/install.mjs --prompt   self-contained prompt with both halves
//   node scripts/install.mjs --json     machine-readable payload
//   node scripts/install.mjs --host-only|--client-only
// ============================================================================

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const argv = process.argv.slice(2)
const AS_JSON = argv.includes('--json')
const AS_PROMPT = argv.includes('--prompt')
const HOST_ONLY = argv.includes('--host-only')
const CLIENT_ONLY = argv.includes('--client-only')

const ID_PREFIX = 'canvas'
const PACKAGE_NAME = 'Session Canvas'
const PURPOSE = 'A session-topology canvas in the DSH Web GUI: sessions as nodes, real lineage as edges, with multi-turn prompting of ordinary sessions.'

function readHalf(kind) {
  const file = path.join(ROOT, 'src', kind + '.js')
  if (!fs.existsSync(file)) throw new Error('missing ' + file)
  const src = fs.readFileSync(file, 'utf8')
  return {
    kind: kind,
    file: file,
    src: src,
    bytes: Buffer.byteLength(src, 'utf8'),
    sha256: crypto.createHash('sha256').update(src).digest('hex'),
  }
}

// -- gate first: never emit a payload for source the pre-flight rejects -------
const gate = spawnSync(process.execPath, [path.join(HERE, 'check.mjs')], { encoding: 'utf8' })
if (gate.status !== 0) {
  process.stderr.write('pre-flight failed; refusing to emit a payload\n')
  process.stderr.write(gate.stdout || '')
  process.stderr.write(gate.stderr || '')
  process.exit(1)
}
const gateTail = String(gate.stdout || '').trim().split('\n').pop()

const halves = []
if (!CLIENT_ONLY) halves.push(readHalf('host'))
if (!HOST_ONLY) halves.push(readHalf('client'))

const code = {}
for (const h of halves) code[h.kind] = h.src

const payload = {
  plugin: { kind: 'new', idPrefix: ID_PREFIX },
  name: PACKAGE_NAME,
  purpose: PURPOSE,
  code: code,
}

const fingerprints = halves.map((h) => ({ half: h.kind, bytes: h.bytes, sha256: h.sha256, file: h.file }))

if (AS_JSON) {
  console.log(JSON.stringify({
    gate: gateTail,
    fingerprints: fingerprints,
    define: payload,
  }, null, 2))
  process.exit(0)
}

const lines = []
lines.push('Install the Session Canvas dynamic Cordis package.')
lines.push('')
lines.push('Pre-flight gate: ' + gateTail)
for (const f of fingerprints) {
  lines.push('  ' + f.half.padEnd(6) + ' ' + String(f.bytes).padStart(6) + ' bytes  sha256 ' + f.sha256)
  if (!AS_PROMPT) lines.push('         source: ' + f.file)
}
lines.push('')
if (!AS_PROMPT) {
  lines.push('Read each source file above and pass its exact contents as code.<half> — do not')
  lines.push('reformat, re-indent, or "fix" anything. The argument for cordis_define is:')
} else {
  lines.push('Call cordis_define with the JSON object at the end of this prompt, verbatim. Its')
  lines.push('`code.host` / `code.client` values are the complete sources of the two halves.')
}
lines.push('')
lines.push('  {')
lines.push('    "plugin": { "kind": "new", "idPrefix": "' + ID_PREFIX + '" },')
lines.push('    "name": "' + PACKAGE_NAME + '",')
lines.push('    "purpose": "' + PURPOSE + '",')
lines.push('    "code": { ' + halves.map((h) => '"' + h.kind + '": <' + h.kind + ' source>').join(', ') + ' }')
lines.push('  }')
lines.push('')
lines.push('Then:')
lines.push('  1. cordis_run(pluginId=<returned>, packageId=<returned>, mode="run").')
lines.push('  2. A client half comes back awaiting-approval: approve it in the Plugins panel')
lines.push('     (one check mark authorises this package, two authorise this plugin\'s future')
lines.push('     packages as well).')
lines.push('  3. Refresh the browser page — a client half only loads at page load.')
lines.push('  4. A "会话拓扑" entry appears in the left sidebar; the panel registers under')
lines.push('     main key "session-canvas".')

if (AS_PROMPT) {
  lines.push('')
  lines.push('--- BEGIN cordis_define ARGUMENT (JSON) ---')
  lines.push(JSON.stringify(payload))
  lines.push('--- END cordis_define ARGUMENT ---')
}

console.log(lines.join('\n'))
