'use strict'
// patch26
//  1. FIX "文件无法正常移动": the layout index lives in a useMemo keyed on
//     [st.files, st.agents]. A file drag writes manual[path] then store.set({}), which
//     does NOT change st.files, so the memo never rebuilt and filePosOf kept returning
//     the OLD slot - the node snapped back on release. manual is now consulted first in
//     filePosOf, and every manual mutation bumps st.manualVersion, which IS a memo dep.
//  2. GROUP BY FOLDER: each directory becomes a labelled box on the canvas and its
//     direct files are stacked inside it. Depth picks the column; siblings stack down.
//  3. SPLIT: a file with a manual position is detached from its box and drawn as an
//     independent node where it was dropped. A directory panel adds 拆分/收回 to move
//     all of its direct files out at once (or put them back).
const fs = require('fs')
const C = '/tmp/acx/v21.client.js'
let c = fs.readFileSync(C, 'utf8')

function sub(from, to, label) {
  const n = c.split(from).length - 1
  if (n === 0) throw new Error('ANCHOR MISSING: ' + label)
  if (n > 1) throw new Error('ANCHOR NOT UNIQUE (' + n + '): ' + label)
  c = c.replace(from, to)
}

// ---------------- store fields ----------------
sub("      inspectId: null,", "      inspectId: null,\n      inspectDir: null,\n      manualVersion: 0,", 'store fields')

// ---------------- bumpManual ----------------
sub(
  '    store.subscribe(persistSoon)',
  `    store.subscribe(persistSoon)
    // Every mutation of manual[] must go through here: the layout index is built in a
    // memo that cannot observe a plain object mutation, and manualVersion is its dep.
    function bumpManual() {
      store.set({ manualVersion: (store.get().manualVersion || 0) + 1 })
    }`,
  'bumpManual',
)

// ---------------- layout constants ----------------
sub(
  `    // FOLDER-HIERARCHY LAYOUT
    // Every file node is placed by its path, not by a flat counter:
    //   depth  -> which column band it sits in (children right of their parent)
    //   dir    -> a stable small offset so siblings cluster, not interleave
    //   index  -> vertical slot inside its own band
    // manual[] (a hand drag) always wins over the computed position.
    // -----------------------------------------------------------------------
    const DIR_COL_W = FILE_W + 52
    const NODE_ROW_H = FILE_H + 10
    const MD_NODE_H = 118`,
  `    // FOLDER-GROUPED LAYOUT
    // Files are grouped the way a file manager groups them: every directory is a
    // labelled BOX on the canvas, and the files directly inside it are stacked in it.
    // Depth picks the column, sibling directories stack down that column.
    // A file with a manual position (manual[path]) is SPLIT OUT: it is drawn as an
    // independent node where it was dropped and no longer takes a slot in the box.
    // -----------------------------------------------------------------------
    const COL_W = FILE_W + 90
    const NODE_ROW_H = FILE_H + 10
    const MD_NODE_H = 118
    const BOX_PAD = 10
    const BOX_HEAD = 26
    const BOX_W = FILE_W + BOX_PAD * 2`,
  'layout constants',
)

// ---------------- filePos -> relToAgentOf ----------------
sub(
  `    function filePos(agent, index, file) {
      const m = manual[file.path]
      if (m) return m
      const rel = file && typeof file.rel === 'string' ? file.rel : ''
      const depth = depthOfRel(rel)
      const dir = dirOfRel(rel)
      let h = 0
      for (let i = 0; i < dir.length; i++) h = (h * 31 + dir.charCodeAt(i)) % 997
      const band = depth * DIR_COL_W + (h % 2) * 10
      const row = index % 9
      const stack = Math.floor(index / 9)
      return {
        x: agent.x + 150 + band,
        y: agent.y - 30 + row * NODE_ROW_H + stack * (9 * NODE_ROW_H + 20),
      }
    }`,
  `    // A file's path relative to the agent that owns it. Sections are keyed by this, so
    // two agents that both contain "src/app.ts" still get separate boxes.
    function relToAgentOf(file, owner) {
      const p = String((file && file.path) || '')
      const cwd = owner && owner.cwd ? String(owner.cwd) : ''
      if (cwd && (p === cwd || p.indexOf(cwd + '/') === 0)) {
        return p === cwd ? '' : p.slice(cwd.length + 1)
      }
      return String((file && (file.rel || file.name)) || p)
    }`,
  'relToAgentOf',
)

fs.writeFileSync(C, c)
console.log('patch26 stage A ok:', c.length)
