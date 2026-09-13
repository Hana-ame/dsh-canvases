const fs = require('fs')
const p = '/tmp/acx/u.client.js'
let c = fs.readFileSync(p, 'utf8')

function rep(from, to, label) {
  const n = c.split(from).length - 1
  if (n !== 1) throw new Error(label + ': expected 1 but found ' + n)
  c = c.replace(from, to)
  console.log('ok:', label)
}

// 1. The inspector: opened by clicking an agent node; owns all editing.
rep(
  ['      function openAgentForm(prefillMission, prefillCwd) {', '        setForm({ kind: \'agent\' })', '        setFormMission(prefillMission || \'\')', '        setFormCwd(prefillCwd || \'\')', "        setFormPreset('')", '        setFormErr(null)', '      }'].join('\n'),
  [
    '      function openInspector(agent) {',
    '        store.set({ inspectId: agent.id, activeAgentId: agent.id })',
    '      }',
    '      function closeInspector() {',
    '        store.set({ inspectId: null })',
    '      }',
    '      async function rebindAgent(agent) {',
    '        const st0 = store.get()',
    '        if (!st0.workspace) {',
    "          setToast({ id: nextId('t'), text: '\\u8bf7\\u5148\\u70b9\\u300c\\u9009\\u5de5\\u4f5c\\u533a\\u300d' })",
    '          return',
    '        }',
    "        store.set({ agents: st0.agents.map(function (a) { return a.id === agent.id ? merge(a, { pending: true, error: null }) : a }) })",
    "        const suggested = agent.cwd || (st0.workspace + '/' + slugify(firstLine(agent.mission, 24) || 'agent'))",
    '        let r = null',
    '        try {',
    "          r = await createAgent(agent.mission || agent.name, suggested, '')",
    '        } catch (e) {',
    "          r = { ok: false, error: String((e && e.message) || e) }",
    '        }',
    '        const cur = store.get()',
    '        const next = cur.agents.map(function (a) {',
    '          if (a.id !== agent.id) return a',
    "          return r && r.ok",
    "            ? merge(a, { sessionId: r.sessionId, cwd: r.cwd || suggested, pending: false, error: null })",
    "            : merge(a, { pending: false, error: (r && r.error) || 'create failed' })",
    '        })',
    '        store.set({ agents: next })',
    '        refresh()',
    '      }',
    '      function updateAgent(id, patch) {',
    '        const cur = store.get()',
    "        store.set({ agents: cur.agents.map(function (a) { return a.id === id ? merge(a, patch) : a }) })",
    '      }',
  ].join('\n'),
  'inspector functions',
)

// 2. The inspector node in the store.
rep(
  '      mode: cached.mode === "agent" ? "agent" : "file",',
  "      mode: cached.mode === 'agent' ? 'agent' : 'file',\n      inspectId: null,",
  'store inspectId',
)

// 3. Toolbar: mode switch + instant agent creation.
rep(
  "        h('button', { className: 'acx-btn acx-primary', onClick: function () { openAgentForm('', '') } }, '+ Agent'),",
  [
    "        h('button', {",
    "          className: st.mode === 'file' ? 'acx-btn acx-primary' : 'acx-btn',",
    "          onClick: function () { store.set({ mode: 'file' }) },",
    "        }, '\\u79fb\\u52a8\\u6587\\u4ef6'),",
    "        h('button', {",
    "          className: st.mode === 'agent' ? 'acx-btn acx-primary' : 'acx-btn',",
    "          onClick: function () { store.set({ mode: 'agent' }) },",
    "        }, '\\u79fb\\u52a8 Agent'),",
    "        h('button', { className: 'acx-btn acx-primary', onClick: spawnAgent }, '+ Agent'),",
  ].join('\n'),
  'toolbar mode switch + instant agent',
)

// 4. The selection-derived agent form no longer exists; drop its builder.
fs.writeFileSync(p, c)
console.log('written')
