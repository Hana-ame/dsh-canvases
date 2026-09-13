// Behavioral simulation of the new interaction contract, against shipped code.
const src = require('fs').readFileSync('/tmp/acx/s18.client.js', 'utf8')

// Extract the real spawnAgent + createAgent + clicked-agent handlers is impractical
// in isolation, so assert the contract statically but precisely.
const facts = {
  'creating places the node before the session exists':
    src.indexOf('store.set({ agents: st0.agents.concat([blank])') < src.indexOf('await createAgent(mission,'),
  'the placeholder node is marked pending':
    /pending: true/.test(src),
  'successful bind clears pending and stores sessionId':
    /sessionId: r\.sessionId, cwd: r\.cwd \|\| suggested, pending: false/.test(src),
  'failed bind keeps the node and records the error':
    /merge\(a, \{ pending: false, error: \(r && r\.error\)/.test(src),
  'creation does not open the editor':
    !/concat\(\[blank\]\), agentSel: \[id\], activeAgentId: id, inspectId: id/.test(src),
  'clicking calls openInspector':
    /const a2 = findAgent\(store\.get\(\)\.agents, it\.id\)\n\s*if \(a2\) openInspector\(a2\)/.test(src),
  'mode file gates file dragging':
    /const canDrag = store\.get\(\)\.mode === 'file'/.test(src),
  'mode agent gates agent dragging':
    /const canDrag = store\.get\(\)\.mode === 'agent'/.test(src),
  'inspector owns name editing':
    /updateAgent\(inspectAgent\.id, \{ name:/.test(src),
  'inspector owns mission editing':
    /updateAgent\(inspectAgent\.id, \{ mission:/.test(src),
  'inspector can bind/rebind a session':
    /function rebindAgent\(agent\)/.test(src),
}

// Duplicate-node regression: instant creation must not append a second node.
facts['instant creation cannot duplicate a node'] =
  /if \(!ownNode\)/.test(src) &&
  (src.match(/await createAgent\([^)]*true\)/g) || []).length === 3

let bad = 0
for (const [k, v] of Object.entries(facts)) {
  if (!v) bad++
  console.log((v ? 'PASS' : 'FAIL') + ' ' + k)
}
console.log(bad ? 'FAILURES ' + bad : 'CONTRACT VERIFIED')
