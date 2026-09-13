'use strict'
// patch26 stage E: render the folder panel (拆分/收回) in the right column.
const fs = require('fs')
const C = '/tmp/acx/v21.client.js'
let c = fs.readFileSync(C, 'utf8')

function sub(from, to, label) {
  const n = c.split(from).length - 1
  if (n === 0) throw new Error('ANCHOR MISSING: ' + label)
  if (n > 1) throw new Error('ANCHOR NOT UNIQUE (' + n + '): ' + label)
  c = c.replace(from, to)
}

sub(
  '      let settingsPanel = null',
  '      let settingsPanel = null\n      let dirPanel = null',
  'dirPanel decl',
)

// build it right after the settings panel is finalised, before the project dialog
sub(
  "      if (form && form.kind === 'project') {",
  `      const inspectDirFile = st.inspectDir ? (fileByPath[st.inspectDir] || null) : null
      if (inspectDirFile !== null) {
        const kids = dirChildren(inspectDirFile.path)
        const splitOut = kids.filter(function (k) { return manual[k.path] !== undefined })
        // 点击文件夹后的 split 面板：把一个文件夹拆成若干独立文件节点，或收回。
        dirPanel = h('div', { className: 'acx-side' },
          h('div', { className: 'acx-sheet-head' },
            h('b', null, '文件夹'),
            h('span', { className: 'acx-sm' }, inspectDirFile.name),
            h('button', { className: 'acx-btn', onClick: function () { store.set({ inspectDir: null }) } }, '收起'),
          ),
          h('div', { className: 'acx-mono' }, inspectDirFile.path),
          h('div', { className: 'acx-sm' },
            '直接文件 ' + String(kids.length) + ' 个，其中已拆出 ' + String(splitOut.length) + ' 个独立节点。'),
          h('div', { className: 'acx-hint' },
            '文件夹默认是 1 个节点。点「拆分为独立节点」会把里面的文件放出来，各自成为一个可单独拖动、可单独选中的节点；也可以直接在画布上把某个文件拖出文件夹框，效果相同。'),
          h('div', { className: 'acx-btns' },
            h('button', {
              className: 'acx-btn acx-primary',
              disabled: kids.length === 0,
              onClick: function () { splitDir(inspectDirFile.path) },
            }, '拆分为独立节点'),
            h('button', {
              className: 'acx-btn',
              disabled: splitOut.length === 0,
              onClick: function () { unsplitDir(inspectDirFile.path) },
            }, '收回 ' + (splitOut.length > 0 ? String(splitOut.length) + ' 个' : '')),
            h('button', {
              className: 'acx-btn',
              onClick: function () {
                store.set({ fileSel: kids.map(function (k) { return k.path }) })
              },
            }, '选中全部子文件'),
          ),
        )
      }
      if (form && form.kind === 'project') {`,
  'folder panel render',
)

// mount it in the right column, ahead of the agent settings panel
sub(
  "        (settingsPanel !== null || st.dock) ? h('div', { className: 'acx-right' }, settingsPanel, st.dock ? h(ChatDock, { touch: touchMode }) : null) : null,",
  "        (dirPanel !== null || settingsPanel !== null || st.dock) ? h('div', { className: 'acx-right' }, dirPanel, settingsPanel, st.dock ? h(ChatDock, { touch: touchMode }) : null) : null,",
  'mount folder panel',
)

fs.writeFileSync(C, c)
console.log('patch26 stage E ok:', c.length)
