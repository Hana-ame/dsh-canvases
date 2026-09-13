const fs = require('fs')
const p = '/tmp/acx/u.client.js'
let c = fs.readFileSync(p, 'utf8')

function rep(from, to, label) {
  const n = c.split(from).length - 1
  if (n !== 1) throw new Error(label + ': expected 1 but found ' + n)
  c = c.replace(from, to)
  console.log('ok:', label)
}

// The export actions, wired to the three products.
rep(
  '      function openInspector(agent) {',
  [
    '      function exportStamp() {',
    "        return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)",
    '      }',
    '      function exportJson() {',
    '        const st0 = store.get()',
    '        const doc = buildExportDoc(st0)',
    '        const ok = downloadText(',
    "          'agent-canvas-' + exportStamp() + '.json',",
    '          JSON.stringify(doc, null, 2),',
    "          'application/json',",
    '        )',
    "        setToast({ id: nextId('t'), text: ok ? '\\u5df2\\u5bfc\\u51fa JSON' : '\\u5bfc\\u51fa\\u5931\\u8d25' })",
    '      }',
    '      function exportMarkdown() {',
    '        const st0 = store.get()',
    '        const md = buildMarkdown(st0)',
    '        const ok = downloadText(',
    "          'agent-canvas-' + exportStamp() + '.md',",
    '          md,',
    "          'text/markdown;charset=utf-8',",
    '        )',
    "        setToast({ id: nextId('t'), text: ok ? '\\u5df2\\u5bfc\\u51fa Markdown' : '\\u5bfc\\u51fa\\u5931\\u8d25' })",
    '      }',
    '      async function exportMarkdownToWorkspace() {',
    '        const st0 = store.get()',
    '        if (!st0.workspace) {',
    "          setToast({ id: nextId('t'), text: '\\u8bf7\\u5148\\u7ed1\\u5b9a\\u5de5\\u4f5c\\u533a' })",
    '          return',
    '        }',
    '        const md = buildMarkdown(st0)',
    "        const target = st0.workspace.replace(/\\/+$/, '') + '/AGENT-CANVAS.md'",
    "        const r = await hostCall('canvas-export-file', { path: target, content: md }, 15000)",
    '        if (r.ok) {',
    "          setToast({ id: nextId('t'), text: '\\u5df2\\u5199\\u5165 ' + target })",
    '        } else {',
    "          setToast({ id: nextId('t'), text: '\\u5199\\u5165\\u5931\\u8d25: ' + (r.error || '') })",
    '        }',
    '      }',
    '      function exportPng() {',
    '        const st0 = store.get()',
    '        const posOf = function (f) {',
    '          const owner = findAgent(st0.agents, f.agentId)',
    '          let index = 0',
    '          let seen = 0',
    '          for (let i = 0; i < st0.files.length; i++) {',
    '            if (st0.files[i].agentId !== f.agentId) continue',
    '            if (st0.files[i].path === f.path) { index = seen; break }',
    '            seen += 1',
    '          }',
    '          if (!owner) return { x: 60, y: 60 }',
    '          return filePos(owner, index, f)',
    '        }',
    '        let canvas = null',
    '        try {',
    '          canvas = drawPng(st0, posOf, AGENT_SIZE)',
    '        } catch (e) {',
    '          canvas = null',
    '        }',
    '        if (!canvas) {',
    "          setToast({ id: nextId('t'), text: '\\u751f\\u6210\\u56fe\\u7247\\u5931\\u8d25' })",
    '          return',
    '        }',
    '        try {',
    "          const url = canvas.toDataURL('image/png')",
    '          const a = document.createElement(\'a\')',
    '          a.href = url',
    "          a.download = 'agent-canvas-' + exportStamp() + '.png'",
    '          document.body.appendChild(a)',
    '          a.click()',
    '          a.remove()',
    "          setToast({ id: nextId('t'), text: '\\u5df2\\u5bfc\\u51fa PNG' })",
    '        } catch (e) {',
    "          setToast({ id: nextId('t'), text: '\\u5bfc\\u51fa PNG \\u5931\\u8d25: ' + String((e && e.message) || e) })",
    '        }',
    '      }',
    '      function openInspector(agent) {',
  ].join('\n'),
  'export actions',
)

// Toolbar: one export group.
rep(
  "        h('button', { className: 'acx-btn', onClick: openProjectForm }, '\\u6295\\u5f71\\u4f1a\\u8bdd'),",
  [
    "        h('button', { className: 'acx-btn', onClick: openProjectForm }, '\\u6295\\u5f71\\u4f1a\\u8bdd'),",
    "        h('button', { className: 'acx-btn', onClick: exportPng }, '\\u5bfc\\u51fa PNG'),",
    "        h('button', { className: 'acx-btn', onClick: exportJson }, '\\u5bfc\\u51fa JSON'),",
    "        h('button', { className: 'acx-btn', onClick: exportMarkdown }, '\\u5bfc\\u51fa MD'),",
    "        h('button', { className: 'acx-btn', onClick: exportMarkdownToWorkspace }, '\\u5199\\u5165\\u5de5\\u4f5c\\u533a'),",
  ].join('\n'),
  'toolbar export buttons',
)

fs.writeFileSync(p, c)
console.log('written')
