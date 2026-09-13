'use strict'
// pkg-19 gate: workspace binding can no longer fail silently.
const fs = require('fs')
const c = fs.readFileSync('/tmp/acx/u.client.js', 'utf8')
const h = fs.readFileSync('/tmp/acx/u.host.js', 'utf8')

// the whole binding flow, from the dialog opener up to the next unrelated function
const flowStart = c.indexOf('      function openWorkspaceForm(')
const flowEnd = c.indexOf('      function openProjectForm(')
if (flowStart < 0 || flowEnd < flowStart) throw new Error('binding flow region not found')
const flow = c.slice(flowStart, flowEnd)

// returns inside the flow that are NOT adjacent to a visible error write
const flowLines = flow.split('\n')
const nakedReturns = []
for (let i = 0; i < flowLines.length; i++) {
  if (!/^\s*return\b/.test(flowLines[i])) continue
  let guarded = false
  for (let j = Math.max(0, i - 6); j < i; j++) if (flowLines[j].indexOf('setFormErr(') >= 0) guarded = true
  if (!guarded) nakedReturns.push(flowLines[i].trim())
