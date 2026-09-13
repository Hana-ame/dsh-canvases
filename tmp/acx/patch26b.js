'use strict'
// patch26 stage B: the section-based layout index + filePosOf(manual first).
const fs = require('fs')
const C = '/tmp/acx/v21.client.js'
let c = fs.readFileSync(C, 'utf8')

function sub(from, to, label) {
  const n = c.split(from).length - 1
  if (n === 0) throw new Error('ANCHOR MISSING: ' + label)
  if (n > 1) throw new Error('ANCHOR NOT UNIQUE (' + n + '): ' + label)
  c = c.replace(from, to)
}

// ---------------- the memo ----------------
sub(
  `      const idx = React.useMemo(function () {
        const filePosIndex = {}
        const fileByPath = {}
        const agentFileCount = {}
        const agentsById = {}
        for (let i = 0; i < st.agents.length; i++) agentsById[st.agents[i].id] = st.agents[i]
        const ownerSeen = {}
        for (let i = 0; i < st.files.length; i++) {
          const f = st.files[i]
          fileByPath[f.path] = f
          const key = f.agentId === null || f.agentId === undefined ? '' : String(f.agentId)
          const seen = ownerSeen[key] === undefined ? 0 : ownerSeen[key]
          ownerSeen[key] = seen + 1
          const owner = f.agentId ? agentsById[f.agentId] : null
          filePosIndex[f.path] = owner ? filePos(owner, seen, f) : { x: 60, y: 60 }
          if (f.agentId) {
            const cnt = agentFileCount[f.agentId]
            if (cnt === undefined) agentFileCount[f.agentId] = { total: 1, fresh: f.isNew ? 1 : 0 }
            else { cnt.total += 1; if (f.isNew) cnt.fresh += 1 }
          }
        }
        return { filePosIndex: filePosIndex, fileByPath: fileByPath, agentFileCount: agentFileCount, agentsById: agentsById }
      }, [st.files, st.agents])
      const filePosIndex = idx.filePosIndex
      const fileByPath = idx.fileByPath
      const agentFileCount = idx.agentFileCount
      const agentsById = idx.agentsById`,
  `      // manualVersion is a DEPENDENCY on purpose: dragging a file mutates manual[],
      // which no memo can observe, so the mutation also bumps this counter.
      const idx = React.useMemo(function () {
        const filePosIndex = {}
        const fileByPath = {}
        const agentFileCount = {}
        const agentsById = {}
        const sections = []
        const sectionByKey = {}
        for (let i = 0; i < st.agents.length; i++) agentsById[st.agents[i].id] = st.agents[i]
        function ensureSection(owner, dirRel) {
          const key = owner.id + '|' + dirRel
          let s = sectionByKey[key]
          if (s === undefined) {
            s = {
              key: key,
              agentId: owner.id,
              dirRel: dirRel,
              depth: dirRel === '' ? 0 : depthOfRel(dirRel),
              name: dirRel === '' ? (basename(owner.cwd || '') || '工作区根目录') : dirRel.slice(dirRel.lastIndexOf('/') + 1),
              parentKey: dirRel === '' ? null : (owner.id + '|' + dirOfRel(dirRel)),
              dirPath: null,
              files: [],
              total: 0,
              x: 0, y: 0, w: BOX_W, h: BOX_HEAD + BOX_PAD,
            }
            sectionByKey[key] = s
            sections.push(s)
          }
          return s
        }
        // pass 1: a section for every directory entry, plus one for each parent
        for (let i = 0; i < st.files.length; i++) {
          const f = st.files[i]
          fileByPath[f.path] = f
          const owner = f.agentId ? agentsById[f.agentId] : null
          if (!owner) continue
          const rel = relToAgentOf(f, owner)
          ensureSection(owner, dirOfRel(rel))
          if (f.type === 'directory') {
            const own = ensureSection(owner, rel)
            own.dirPath = f.path
          }
        }
        // pass 2: files land in their own directory's box; a split-out file does not
        for (let i = 0; i < st.files.length; i++) {
          const f = st.files[i]
          if (f.type === 'directory') continue
          const owner = f.agentId ? agentsById[f.agentId] : null
          if (!owner) continue
          const s = ensureSection(owner, dirOfRel(relToAgentOf(f, owner)))
          s.total += 1
          if (manual[f.path] === undefined) s.files.push(f)
        }
        for (let i = 0; i < st.files.length; i++) {
          const f = st.files[i]
          if (!f.agentId) continue
          const cnt = agentFileCount[f.agentId]
          if (cnt === undefined) agentFileCount[f.agentId] = { total: 1, fresh: f.isNew ? 1 : 0 }
          else { cnt.total += 1; if (f.isNew) cnt.fresh += 1 }
        }
        // place: depth picks the column, sections of one column stack downward
        sections.sort(function (a, b) {
          if (a.agentId !== b.agentId) return a.agentId < b.agentId ? -1 : 1
          if (a.depth !== b.depth) return a.depth - b.depth
          return a.dirRel < b.dirRel ? -1 : (a.dirRel > b.dirRel ? 1 : 0)
        })
        const cursor = {}
        for (let i = 0; i < sections.length; i++) {
          const s = sections[i]
          const owner = agentsById[s.agentId]
          if (!owner) continue
          const ck = s.agentId + '|' + s.depth
          const y0 = cursor[ck] === undefined ? 0 : cursor[ck]
          s.x = owner.x + 150 + s.depth * COL_W
          s.y = owner.y - 30 + y0
          let hh = BOX_HEAD + BOX_PAD
          for (let j = 0; j < s.files.length; j++) hh += nodeH(s.files[j]) + 8
          s.h = hh < BOX_HEAD + BOX_PAD + 24 ? BOX_HEAD + BOX_PAD + 24 : hh
          cursor[ck] = y0 + s.h + 26
          let yy = s.y + BOX_HEAD
          for (let j = 0; j < s.files.length; j++) {
            const f = s.files[j]
            filePosIndex[f.path] = { x: s.x + BOX_PAD, y: yy }
            yy += nodeH(f) + 8
          }
        }
        // a directory NODE is represented by its box, so it still hit-tests and hovers
        for (let i = 0; i < st.files.length; i++) {
          const f = st.files[i]
          if (f.type !== 'directory') continue
          const owner = f.agentId ? agentsById[f.agentId] : null
          if (!owner) continue
          const s = sectionByKey[owner.id + '|' + relToAgentOf(f, owner)]
          if (s !== undefined) filePosIndex[f.path] = { x: s.x, y: s.y, w: s.w, h: s.h }
        }
        // files with no owning agent: a loose column, so they do not pile on one spot
        let loose = 0
        for (let i = 0; i < st.files.length; i++) {
          const f = st.files[i]
          if (f.agentId) continue
          if (manual[f.path] !== undefined) continue
          if (filePosIndex[f.path] !== undefined) continue
          filePosIndex[f.path] = { x: 60, y: 60 + loose * NODE_ROW_H }
          loose += 1
        }
        return {
          filePosIndex: filePosIndex,
          fileByPath: fileByPath,
          agentFileCount: agentFileCount,
          agentsById: agentsById,
          sections: sections,
          sectionByKey: sectionByKey,
        }
      }, [st.files, st.agents, st.manualVersion])
      const filePosIndex = idx.filePosIndex
      const fileByPath = idx.fileByPath
      const agentFileCount = idx.agentFileCount
      const agentsById = idx.agentsById
      const sections = idx.sections
      const sectionByKey = idx.sectionByKey`,
  'section memo',
)

// ---------------- filePosOf: manual wins ----------------
sub(
  `      function filePosOf(f) {
        const p = filePosIndex[f.path]
        return p === undefined ? { x: 60, y: 60 } : p
      }`,
  `      // manual[] first: a hand drag (or a split) always beats the computed slot, and
      // this is what makes a dropped file stay where it was dropped.
      function filePosOf(f) {
        if (!f) return { x: 60, y: 60 }
        const m = manual[f.path]
        if (m !== undefined) return m
        const p = filePosIndex[f.path]
        return p === undefined ? { x: 60, y: 60 } : p
      }
      function sectionOf(dirPath) {
        for (let i = 0; i < sections.length; i++) if (sections[i].dirPath === dirPath) return sections[i]
        return null
      }`,
  'filePosOf manual first',
)

fs.writeFileSync(C, c)
console.log('patch26 stage B ok:', c.length)
