const fs = require('fs')
const p = '/tmp/acx/p14.client.js'
let c = fs.readFileSync(p, 'utf8')

function rep(from, to, label) {
  const n = c.split(from).length - 1
  if (n !== 1) throw new Error(label + ': expected 1 but found ' + n)
  c = c.replace(from, to)
  console.log('ok:', label)
}

// 1. Seed the store from the canvas cache instead of an empty canvas.
const OLD_STORE = [
  '    const store = createStore({',
  '      agents: [],',
  '      files: [],',
  '      agentSel: [],',
  '      fileSel: [],',
  '      activeAgentId: null,',
  '      sessions: {},',
  '      sessionList: [],',
  '      dock: false,',
  '      home: null,',
  '      workspace: null,',
  '      wsError: null,',
  '      scanNote: null,',
  '      lastScan: null,',
  '    })',
].join('\n')

const NEW_STORE = [
  '    const cached = loadCache() || {}',
  '    const cachedAgents = Array.isArray(cached.agents) ? cached.agents : []',
  '    const cachedPositions = cached.positions && typeof cached.positions === "object" ? cached.positions : {}',
  '    const store = createStore({',
  '      agents: cachedAgents,',
  '      files: [],',
  '      agentSel: [],',
  '      fileSel: [],',
  '      activeAgentId: null,',
  '      sessions: {},',
  '      sessionList: [],',
  '      dock: cached.dock === true,',
  '      home: null,',
  '      workspace: typeof cached.workspace === "string" ? cached.workspace : null,',
  '      wsError: null,',
  '      scanNote: null,',
  '      lastScan: null,',
  '    })',
].join('\n')

rep(OLD_STORE, NEW_STORE, 'hydrate store from cache')

// 2. Positions come from the cache so a reload keeps the operator's layout.
rep(
  '    const baselines = {}\n    const manual = {}',
  [
    '    const baselines = {}',
    '    const manual = {}',
    '    for (const k in cachedPositions) {',
    '      const v = cachedPositions[k]',
    '      if (v && typeof v.x === "number" && typeof v.y === "number") manual[k] = { x: v.x, y: v.y }',
    '    }',
    '    let persistTimer = null',
    '    function persist() {',
    '      const s = store.get()',
    '      const positions = {}',
    '      for (const k in manual) positions[k] = { x: manual[k].x, y: manual[k].y }',
    '      const agents = s.agents.map(function (a) {',
    '        return { id: a.id, name: a.name, mission: a.mission, sessionId: a.sessionId, cwd: a.cwd, x: a.x, y: a.y, color: a.color, tag: a.tag }',
    '      })',
    '      saveCache({ version: 1, workspace: s.workspace, dock: s.dock, agents: agents, positions: positions, savedAt: Date.now() })',
    '    }',
    '    function persistSoon() {',
    '      if (persistTimer !== null) return',
    '      const timer = ctx.get("timer")',
    '      if (timer === undefined || typeof timer.timeout !== "function") { persist(); return }',
    '      persistTimer = timer.timeout(function () { persistTimer = null; persist() }, 800)',
    '    }',
    '    store.subscribe(persistSoon)',
  ].join('\n'),
  'position restore + persist scheduler',
)

fs.writeFileSync(p, c)
console.log('written')
