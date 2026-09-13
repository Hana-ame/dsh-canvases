const fs = require('fs')
const p = '/tmp/acx/u.client.js'
let c = fs.readFileSync(p, 'utf8')

function rep(from, to, label) {
  const n = c.split(from).length - 1
  if (n !== 1) throw new Error(label + ': expected 1 but found ' + n)
  c = c.replace(from, to)
  console.log('ok:', label)
}

// "Create agent from selected files": spawn a node immediately, then bind a
// session, then fill in the mission that names those files.
rep(
  [
    "      function openAgentFromSelection() {",
    "        const picked = store.get().files.filter(function (f) { return store.get().fileSel.indexOf(f.path) >= 0 })",
    "        if (picked.length === 0) return",
    "        const lines = ['\\u8d1f\\u8d23\\u8fd9\\u4e9b\\u6587\\u4ef6\\uff08\\u6765\\u81ea\\u753b\\u5e03\\u9009\\u62e9\\uff09:']",
    "        for (let i = 0; i < picked.length && i < 40; i++) lines.push('- ' + picked[i].path)",
    "        lines.push('')",
    "        lines.push('\\u53ea\\u6539\\u8fd9\\u4e9b\\u6587\\u4ef6\\uff0c\\u4e0d\\u8981\\u52a8\\u5176\\u5b83\\u6587\\u4ef6\\u3002')",
    "        openAgentForm(lines.join('\\n'), commonDir(picked.map(function (f) { return f.path })))",
    "      }",
  ].join('\n'),
  [
    "      async function spawnAgentFromSelection() {",
    "        const st0 = store.get()",
    "        const picked = st0.files.filter(function (f) { return st0.fileSel.indexOf(f.path) >= 0 })",
    "        if (picked.length === 0) return",
    "        if (!st0.workspace) {",
    "          setToast({ id: nextId('t'), text: '\\u8bf7\\u5148\\u70b9\\u300c\\u9009\\u5de5\\u4f5c\\u533a\\u300d' })",
    "          return",
    "        }",
    "        const lines = ['\\u8d1f\\u8d23\\u8fd9\\u4e9b\\u6587\\u4ef6\\uff08\\u6765\\u81ea\\u753b\\u5e03\\u9009\\u62e9\\uff09:']",
    "        for (let i = 0; i < picked.length && i < 40; i++) lines.push('- ' + picked[i].path)",
    "        lines.push('')",
    "        lines.push('\\u53ea\\u6539\\u8fd9\\u4e9b\\u6587\\u4ef6\\uff0c\\u4e0d\\u8981\\u52a8\\u5176\\u5b83\\u6587\\u4ef6\\u3002')",
    "        const mission = lines.join('\\n')",
    "        const id = nextId('agent')",
    "        const idx = st0.agents.length",
    "        const blank = {",
    "          id: id,",
    "          name: firstLine(mission, 16) || ('Agent ' + String(idx + 1)),",
    "          mission: mission,",
    "          sessionId: null,",
    "          cwd: null,",
    "          x: 60 + (idx % 4) * 300,",
    "          y: 70 + Math.floor(idx / 4) * 260,",
    "          color: COLORS[idx % COLORS.length],",
    "          tag: 'create',",
    "          pending: true,",
    "        }",
    "        store.set({ agents: st0.agents.concat([blank]), agentSel: [id], activeAgentId: id, inspectId: id })",
    "        const preferred = commonDir(picked.map(function (f) { return f.path }))",
    "        let r = null",
    "        try {",
    "          r = await createAgent(mission, preferred, '')",
    "        } catch (e) {",
    "          r = { ok: false, error: String((e && e.message) || e) }",
    "        }",
    "        const cur = store.get()",
    "        const next = cur.agents.map(function (a) {",
    "          if (a.id !== id) return a",
    "          return r && r.ok",
    "            ? merge(a, { sessionId: r.sessionId, cwd: r.cwd || preferred, pending: false, error: null })",
    "            : merge(a, { pending: false, error: (r && r.error) || 'create failed' })",
    "        })",
    "        store.set({ agents: next, fileSel: [] })",
    "        refresh()",
    "      }",
  ].join('\n'),
  'spawn from selection',
)

rep(
  "          onClick: openAgentFromSelection,",
  "          onClick: spawnAgentFromSelection,",
  'toolbar selection handler',
)

fs.writeFileSync(p, c)
console.log('written')
