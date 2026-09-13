const fs = require('fs')
const p = '/tmp/acx/u.client.js'
let c = fs.readFileSync(p, 'utf8')

function rep(from, to, label) {
  const n = c.split(from).length - 1
  if (n !== 1) throw new Error(label + ': expected 1 but found ' + n)
  c = c.replace(from, to)
  console.log('ok:', label)
}

// createAgent is called with a literal name; no reassignment happens.
rep(
  "        let mission = 'Agent ' + String(idx + 1)",
  "        const mission = 'Agent ' + String(idx + 1)",
  'const mission',
)

// Per the requested flow the node appears first and editing begins when the
// operator clicks it, so creation must not steal focus by opening the panel.
rep(
  [
    '        const after = store.get()',
    '        const target = findAgent(after.agents, id)',
    '        if (target) openInspector(target)',
    '        refresh()',
    '      }',
  ].join('\n'),
  [
    '        refresh()',
    '      }',
  ].join('\n'),
  'no auto-open on spawn',
)

rep(
  "        store.set({ agents: st0.agents.concat([blank]), agentSel: [id], activeAgentId: id, inspectId: id })",
  "        store.set({ agents: st0.agents.concat([blank]), agentSel: [id], activeAgentId: id })",
  'no auto-open from selection',
)

fs.writeFileSync(p, c)
console.log('written')
