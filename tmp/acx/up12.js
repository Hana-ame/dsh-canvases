const fs = require('fs')
const p = '/tmp/acx/u.client.js'
let c = fs.readFileSync(p, 'utf8')

function rep(from, to, label) {
  const n = c.split(from).length - 1
  if (n !== 1) throw new Error(label + ': expected 1 but found ' + n)
  c = c.replace(from, to)
  console.log('ok:', label)
}

// The caller may already own a node (instant creation pre-places one). Return the
// outcome and let the caller bind it, instead of appending a second node.
rep(
  "      async function createAgent(mission, cwdInput, preset) {",
  "      async function createAgent(mission, cwdInput, preset, ownNode) {",
  'createAgent signature',
)

rep(
  [
    '        if (used && baselines[used] === undefined && fresh) baselines[used] = {}',
    '        const cur = store.get()',
    "        const id = nextId('agent')",
    '        const idx = cur.agents.length',
    '        const agent = {',
    "          id: id,",
    "          name: firstLine(mission, 16) || ('Agent ' + String(idx + 1)),",
    '          mission: mission,',
    '          sessionId: res.sessionId,',
    '          cwd: used,',
    '          x: 60 + (idx % 4) * 300,',
    '          y: 70 + Math.floor(idx / 4) * 260,',
    '          color: COLORS[idx % COLORS.length],',
    "          tag: 'create',",
    '        }',
    '        store.set({ agents: cur.agents.concat([agent]), agentSel: [id], activeAgentId: id, dock: true })',
    "        return { ok: true, warning: typed && !used ? '\\u6307\\u5b9a\\u7684\\u5de5\\u4f5c\\u76ee\\u5f55\\u4e0d\\u53ef\\u7528\\uff0c\\u5df2\\u56de\\u9000\\u5230\\u9ed8\\u8ba4\\u76ee\\u5f55' : null }",
  ].join('\n'),
  [
    '        if (used && baselines[used] === undefined && fresh) baselines[used] = {}',
    '        const warning = typed && !used',
    "          ? '\\u6307\\u5b9a\\u7684\\u5de5\\u4f5c\\u76ee\\u5f55\\u4e0d\\u53ef\\u7528\\uff0c\\u5df2\\u56de\\u9000\\u5230\\u9ed8\\u8ba4\\u76ee\\u5f55'",
    '          : null',
    '        // ownNode: the caller already placed the node and will bind this result',
    '        // to it, so creating a second node here would duplicate the agent.',
    '        if (!ownNode) {',
    '          const cur = store.get()',
    "          const id = nextId('agent')",
    '          const idx = cur.agents.length',
    '          const agent = {',
    '            id: id,',
    "            name: firstLine(mission, 16) || ('Agent ' + String(idx + 1)),",
    '            mission: mission,',
    '            sessionId: res.sessionId,',
    '            cwd: used,',
    '            x: 60 + (idx % 4) * 300,',
    '            y: 70 + Math.floor(idx / 4) * 260,',
    '            color: COLORS[idx % COLORS.length],',
    "            tag: 'create',",
    '          }',
    '          store.set({ agents: cur.agents.concat([agent]), agentSel: [id], activeAgentId: id, dock: true })',
    '        }',
    '        return { ok: true, sessionId: res.sessionId, cwd: used, warning: warning }',
  ].join('\n'),
  'createAgent ownNode branch',
)

// Both instant-creation paths own their node.
rep(
  "          r = await createAgent(agent.mission || agent.name, suggested, '')",
  "          r = await createAgent(agent.mission || agent.name, suggested, '', true)",
  'rebind owns node',
)
rep(
  "        r = await createAgent(mission, preferred, '')",
  "        r = await createAgent(mission, preferred, '', true)",
  'selection spawn owns node',
)
rep(
  "          const r = await createAgent(mission, suggested, '')",
  "          const r = await createAgent(mission, suggested, '', true)",
  'spawn owns node',
)

fs.writeFileSync(p, c)
console.log('written')
