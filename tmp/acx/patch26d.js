'use strict'
// patch26 stage D: the folder panel (拆分 / 收回) in the right column.
const fs = require('fs')
const C = '/tmp/acx/v21.client.js'
let c = fs.readFileSync(C, 'utf8')

function sub(from, to, label) {
  const n = c.split(from).length - 1
  if (n === 0) throw new Error('ANCHOR MISSING: ' + label)
  if (n > 1) throw new Error('ANCHOR NOT UNIQUE (' + n + '): ' + label)
  c = c.replace(from, to)
}

// clicking a folder selects it and opens the folder panel
sub(
  `          toggleFile(it.path)
          if (touchMode) setInfo({ kind: 'file', path: it.path })`,
  `          const f2 = fileByPath[it.path]
          if (f2 !== undefined && f2.type === 'directory') {
            // 点击文件夹 -> 右侧面板可以对它做 split
            store.set({ inspectDir: it.path, inspectId: null })
          } else {
            toggleFile(it.path)
            if (touchMode) setInfo({ kind: 'file', path: it.path })
          }`,
  'folder click opens panel',
)

// split / unsplit helpers, next to the zoom helpers
sub(
  '      function sectionOf(dirPath) {',
  `      // Direct files of one folder, relative to the agent that owns it.
      function dirChildren(dirPath) {
        const dir = fileByPath[dirPath]
        if (dir === undefined) return []
        const owner = findAgent(st.agents, dir.agentId)
        const want = relToAgentOf(dir, owner)
        const out = []
        for (let i = 0; i < st.files.length; i++) {
          const f = st.files[i]
          if (f.type === 'directory') continue
          if (f.agentId !== dir.agentId) continue
          if (dirOfRel(relToAgentOf(f, owner)) !== want) continue
          out.push(f)
        }
        return out
      }
      // SPLIT: give every direct file of this folder its own node position, which
      // detaches it from the box. Without this a folder is always a single node.
      function splitDir(dirPath) {
        const kids = dirChildren(dirPath)
        if (kids.length === 0) {
          setToast({ id: nextId('t'), text: '这个文件夹里没有可直接拆出的文件' })
          return
        }
        const sec = sectionOf(dirPath)
        const anchor = filePosOf(fileByPath[dirPath]) || { x: 400, y: 300 }
        const ox = sec !== null ? sec.x + sec.w + 44 : anchor.x + 300
        const oy = sec !== null ? sec.y : anchor.y
        for (let i = 0; i < kids.length; i++) {
          manual[kids[i].path] = {
            x: ox + (i % 4) * (FILE_W + 16),
            y: oy + Math.floor(i / 4) * (FILE_H + 16),
          }
        }
        bumpManual()
        setToast({ id: nextId('t'), text: '已拆出 ' + String(kids.length) + ' 个文件为独立节点，可拖到任意位置' })
      }
      function unsplitDir(dirPath) {
        const kids = dirChildren(dirPath)
        let n = 0
        for (let i = 0; i < kids.length; i++) {
          if (manual[kids[i].path] !== undefined) { delete manual[kids[i].path]; n += 1 }
        }
        if (n === 0) {
          setToast({ id: nextId('t'), text: '这个文件夹没有已拆出的文件' })
          return
        }
        bumpManual()
        setToast({ id: nextId('t'), text: '已收回 ' + String(n) + ' 个文件到文件夹' })
      }
      function sectionOf(dirPath) {`,
  'split helpers',
)

fs.writeFileSync(C, c)
console.log('patch26 stage D ok:', c.length)
