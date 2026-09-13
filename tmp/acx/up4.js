const fs = require('fs')
const p = '/tmp/acx/u.client.js'
let c = fs.readFileSync(p, 'utf8')

function rep(from, to, label) {
  const n = c.split(from).length - 1
  if (n !== 1) throw new Error(label + ': expected 1 but found ' + n)
  c = c.replace(from, to)
  console.log('ok:', label)
}

// Instant creation: place the node first, then bind a session in the background.
// The node is the source of truth; a failure is reported inside its inspector.
rep(
  [
    '      async function submitAgentForm() {',
    '        const mission = formMission.trim()',
    '        if (!mission || formBusy) return',
    '        setFormBusy(true)',
    '        setFormErr(null)',
    '        let r = null',
    '        try {',
    "          const timer = ctx.get('timer')",
    '          const work = createAgent(mission, formCwd, formPreset)',
    "          r = timer !== undefined && typeof timer.timeout === 'function'",
    '            ? await Promise.race([work, timer.timeout(20000).then(function () {',
    "                return { ok: false, error: '\\u6574\\u4f53\\u8d85\\u65f6 20s\\uff1a\\u521b\\u5efa\\u6d41\\u7a0b\\u672a\\u8fd4\\u56de', timeout: true }",
    '              })])',
    '            : await work',
    '        } catch (e) {',
    "          r = { ok: false, error: '\\u521b\\u5efa\\u5f02\\u5e38\\uff1a' + String((e && e.message) || e) }",
    '        } finally {',
    '          setFormBusy(false)',
    '        }',
    '        if (!r || !r.ok) { setFormErr((r && r.error) || \'create failed\'); return }',
    '        setForm(null)',
    "        setFormMission('')",
    '        store.set({ fileSel: [] })',
    "        if (r.warning) setToast({ id: nextId('t'), text: r.warning })",
    '        refresh()',
    '      }',
  ].join('\n'),
  [
    '      // Clicking "+ Agent" must put a node on the canvas immediately; the',
    '      // session is created afterwards and reported on the node itself.',
    '      async function spawnAgent() {',
    '        const st0 = store.get()',
    '        if (!st0.workspace) {',
    "          setToast({ id: nextId('t'), text: '\\u8bf7\\u5148\\u70b9\\u300c\\u9009\\u5de5\\u4f5c\\u533a\\u300d' })",
    '          return',
    '        }',
    '        const id = nextId(\'agent\')',
    '        const idx = st0.agents.length',
    '        const blank = {',
    '          id: id,',
    "          name: 'Agent ' + String(idx + 1),",
    "          mission: '',",
    '          sessionId: null,',
    '          cwd: null,',
    '          x: 60 + (idx % 4) * 300,',
    '          y: 70 + Math.floor(idx / 4) * 260,',
    '          color: COLORS[idx % COLORS.length],',
    "          tag: 'create',",
    "          pending: true,",
    '        }',
    '        store.set({ agents: st0.agents.concat([blank]), agentSel: [id], activeAgentId: id })',
    '        let mission = \'Agent \' + String(idx + 1)',
    '        try {',
    "          const ws = st0.workspace",
    "          const suggested = ws + '/' + slugify('agent-' + String(idx + 1))",
    '          const r = await createAgent(mission, suggested, \'\')',
    '          const cur = store.get()',
    '          if (r && r.ok) {',
    '            const next = cur.agents.map(function (a) {',
    "              return a.id === id ? merge(a, { sessionId: r.sessionId, cwd: r.cwd || suggested, pending: false, error: null }) : a",
    '            })',
    '            store.set({ agents: next })',
    "            if (r.warning) setToast({ id: nextId('t'), text: r.warning })",
    '          } else {',
    '            const next = cur.agents.map(function (a) {',
    "              return a.id === id ? merge(a, { pending: false, error: (r && r.error) || 'create failed' }) : a",
    '            })',
    '            store.set({ agents: next })',
    '          }',
    '        } catch (e) {',
    '          const cur2 = store.get()',
    '          const next2 = cur2.agents.map(function (a) {',
    "            return a.id === id ? merge(a, { pending: false, error: '\\u5f02\\u5e38\\uff1a' + String((e && e.message) || e) }) : a",
    '          })',
    '          store.set({ agents: next2 })',
    '        }',
    '        const after = store.get()',
    '        const target = findAgent(after.agents, id)',
    '        if (target) openInspector(target)',
    '        refresh()',
    '      }',
  ].join('\n'),
  'instant agent spawn',
)

fs.writeFileSync(p, c)
console.log('written')
