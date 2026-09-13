const fs = require('fs')
const p = '/tmp/acx/u.client.js'
let c = fs.readFileSync(p, 'utf8')

function rep(from, to, label) {
  const n = c.split(from).length - 1
  if (n !== 1) throw new Error(label + ': expected 1 but found ' + n)
  c = c.replace(from, to)
  console.log('ok:', label)
}

// 1. Store gains the interaction mode (what dragging moves) and the inspector target.
rep(
  [
    '      workspace: typeof cached.workspace === "string" ? cached.workspace : null,',
    '      wsError: null,',
    '      scanNote: null,',
    '      lastScan: null,',
    '    })',
  ].join('\n'),
  [
    '      workspace: typeof cached.workspace === "string" ? cached.workspace : null,',
    '      wsError: null,',
    '      scanNote: null,',
    '      lastScan: null,',
    '      mode: cached.mode === "agent" ? "agent" : "file",',
    '    })',
  ].join('\n'),
  'store mode',
)

// 2. Persist the mode too, so the canvas reopens in the mode you left it in.
rep(
  "      saveCache({ version: 1, workspace: s.workspace, dock: s.dock, agents: agents, positions: positions, savedAt: Date.now() })",
  "      saveCache({ version: 1, workspace: s.workspace, dock: s.dock, mode: s.mode, agents: agents, positions: positions, savedAt: Date.now() })",
  'persist mode',
)

// 3. Pure selection: no drag, just select and open the inspector.
rep(
  [
    '      function onCanvasPointerDown(e) {',
    '        if (e.button !== 0) return',
  ].join('\n'),
  [
    '      function selectAgent(a) {',
    '        store.set({ agentSel: [a.id], activeAgentId: a.id })',
    '        openInspector(a)',
    '      }',
    '      function selectFile(f) {',
    '        toggleFile(f.path)',
    '        if (touchMode) setInfo({ kind: "file", path: f.path })',
    '      }',
    '      function onCanvasPointerDown(e) {',
    '        if (e.button !== 0) return',
  ].join('\n'),
  'select helpers',
)

fs.writeFileSync(p, c)
console.log('written')
