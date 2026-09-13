const fs = require('fs')
const p = '/tmp/acx/p14.client.js'
let c = fs.readFileSync(p, 'utf8')

function rep(from, to, label) {
  const n = c.split(from).length - 1
  if (n !== 1) throw new Error(label + ': expected 1 but found ' + n)
  c = c.replace(from, to)
  console.log('ok:', label)
}

// Surface the restored-but-unbacked state in the hover card.
rep(
  "            h('div', { className: 'acx-sm' }, (sess && sess.live ? 'live' : 'cold') + ' \\u00b7 \\u9009\\u4e2d\\u5373\\u53ef\\u804a\\u5929'),",
  [
    "            h('div', { className: 'acx-sm' }, (sess && sess.live ? 'live' : 'cold') + ' \\u00b7 \\u9009\\u4e2d\\u5373\\u53ef\\u804a\\u5929'),",
    "            a.missing ? h('div', { className: 'acx-sm acx-warn' }, '\\u4f1a\\u8bdd\\u672a\\u5728\\u5217\\u8868\\u4e2d\\uff08\\u53ef\\u80fd\\u5df2\\u5f52\\u6863\\uff09\\uff0c\\u53d1\\u9001\\u53ef\\u80fd\\u5931\\u8d25') : null,",
  ].join('\n'),
  'missing notice in hover',
)

// A reset control: clears the canvas cache and starts a fresh canvas.
rep(
  "        h('button', { className: 'acx-btn', onClick: function () { setPan({ x: 36, y: 30 }) } }, '\\u590d\\u4f4d'),",
  [
    "        h('button', { className: 'acx-btn', onClick: function () { setPan({ x: 36, y: 30 }) } }, '\\u590d\\u4f4d'),",
    "        h('button', { className: 'acx-btn acx-danger', onClick: function () {",
    "          clearCache()",
    "          for (const k in manual) delete manual[k]",
    "          store.set({ agents: [], agentSel: [], activeAgentId: null, workspace: null, fileSel: [], files: [], wsError: null })",
    "          refresh()",
    "        } }, '\\u6e05\\u7a7a\\u753b\\u5e03'),",
  ].join('\n'),
  'reset canvas button',
)

fs.writeFileSync(p, c)
console.log('written')
