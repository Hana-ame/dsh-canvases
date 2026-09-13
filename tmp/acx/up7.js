const fs = require('fs')
const p = '/tmp/acx/u.client.js'
let c = fs.readFileSync(p, 'utf8')

const lines = c.split('\n')
// Locate the agent-form branch: from `if (form && form.kind === 'agent') {` up to
// the `} else if (form && form.kind === 'project') {` that follows it.
let start = -1
let end = -1
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === "if (form && form.kind === 'agent') {") { start = i; break }
}
if (start < 0) throw new Error('agent form branch not found')
for (let i = start + 1; i < lines.length; i++) {
  if (lines[i].trim().startsWith("} else if (form && form.kind === 'project')")) { end = i; break }
}
if (end < 0) throw new Error('project branch not found')
console.log('replacing lines', start + 1, '..', end)

const inspector = [
  "      // Everything about an agent is edited here, and only here: the node itself",
  "      // is created empty and this panel is what clicking that node opens.",
  "      const inspectAgent = st.inspectId ? findAgent(st.agents, st.inspectId) : null",
  "      if (inspectAgent) {",
  "        const options = [h('option', { key: '__default', value: '' }, '\\u9ed8\\u8ba4 preset')]",
  "        for (let i = 0; i < presets.length; i++) options.push(h('option', { key: presets[i].id, value: presets[i].id }, presets[i].name))",
  "        const sess = st.sessions[inspectAgent.sessionId] || null",
  "        formEl = h('div', { className: 'acx-form' },",
  "          h('div', { className: 'acx-form-title' }, 'Agent ' + inspectAgent.name),",
  "          inspectAgent.pending ? h('div', { className: 'acx-hint' }, '\\u6b63\\u5728\\u521b\\u5efa\\u4f1a\\u8bdd\\u2026') : null,",
  "          inspectAgent.error ? h('div', { className: 'acx-errbox' }, inspectAgent.error) : null,",
  "          h('div', { className: 'acx-row' },",
  "            h('span', { className: 'acx-sm' }, '\\u540d\\u79f0'),",
  "            h('input', {",
  "              className: 'acx-inp',",
  "              value: inspectAgent.name,",
  "              onChange: function (e) { updateAgent(inspectAgent.id, { name: e.target.value }) },",
  "            }),",
  "          ),",
  "          h('div', { className: 'acx-row' },",
  "            h('span', { className: 'acx-sm' }, '\\u4f7f\\u547d prompt'),",
  "          ),",
  "          h('textarea', {",
  "            className: 'acx-ta',",
  "            value: inspectAgent.mission || '',",
  "            placeholder: '\\u4f8b\\u5982\\uff1a\\u5728\\u5de5\\u4f5c\\u533a\\u5185\\u5199\\u4e00\\u4e2a hello.py \\u5e76\\u8fd0\\u884c\\u5b83',",
  "            onChange: function (e) { updateAgent(inspectAgent.id, { mission: e.target.value }) },",
  "          }),",
  "          h('div', { className: 'acx-row' },",
  "            h('span', { className: 'acx-sm' }, 'Agent preset'),",
  "            h('select', { className: 'acx-sel', value: '', onChange: function (e) { if (e.target.value) rebindAgent(merge(inspectAgent, { preset: e.target.value })) } }, options),",
  "          ),",
  "          h('div', { className: 'acx-hsect' },",
  "            h('div', { className: 'acx-hlab' }, '\\u4f1a\\u8bdd\\uff08\\u4f5c\\u4e3a DSH \\u4f1a\\u8bdd\\u7684\\u6295\\u5f71\\uff09'),",
  "            h('div', { className: 'acx-mono' }, inspectAgent.sessionId || '(\\u5c1a\\u672a\\u521b\\u5efa)'),",
  "            inspectAgent.cwd ? h('div', { className: 'acx-mono' }, inspectAgent.cwd) : null,",
  "            h('div', { className: 'acx-sm' }, sess && sess.live ? 'live' : 'cold'),",
  "          ),",
  "          h('div', { className: 'acx-btns' },",
  "            h('button', { className: 'acx-btn', onClick: function () {",
  "              const err = openInSidebar(inspectAgent.sessionId)",
  "              if (err) setToast({ id: nextId('t'), text: err })",
  "            } }, '\\u5728\\u5de6\\u4fa7\\u6253\\u5f00'),",
  "            h('button', { className: 'acx-btn', onClick: function () { rebindAgent(inspectAgent) } }, inspectAgent.sessionId ? '\\u91cd\\u5efa\\u4f1a\\u8bdd' : '\\u521b\\u5efa\\u4f1a\\u8bdd'),",
  "            h('button', { className: 'acx-btn', onClick: function () { forkAgent(inspectAgent) } }, '\\u5206\\u8eab Fork'),",
  "            h('span', { className: 'acx-spacer' }),",
  "            h('button', { className: 'acx-btn acx-danger', onClick: function () { removeAgent(inspectAgent.id); closeInspector() } }, '\\u79fb\\u9664'),",
  "            h('button', { className: 'acx-btn', onClick: closeInspector }, '\\u5b8c\\u6210'),",
  "          ),",
  "        )",
  "      } else if (form && form.kind === 'project') {",
]

lines.splice(start, end - start, ...inspector)
c = lines.join('\n')
fs.writeFileSync(p, c)
console.log('inspector panel installed')
