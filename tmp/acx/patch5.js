const fs = require('fs')
const p = '/tmp/acx/p14.client.js'
let c = fs.readFileSync(p, 'utf8')

function rep(from, to, label) {
  const n = c.split(from).length - 1
  if (n !== 1) throw new Error(label + ': expected 1 but found ' + n)
  c = c.replace(from, to)
  console.log('ok:', label)
}

// Only judge a restored session as gone when the listing actually succeeded;
// a failed/timed-out list must not mass-mark every cached agent as missing.
rep(
  [
    '      const agents = []',
    '      for (let i = 0; i < cur.agents.length; i++) {',
    '        const a = cur.agents[i]',
    '        const s = sessions[a.sessionId]',
    '        // A cached session can disappear (archived/deleted); keep the node but',
    '        // mark it so the UI can show it is no longer backed by a live session.',
    '        if (a.sessionId && !s) { agents.push(merge(a, { cwd: a.cwd || null, missing: true })); continue }',
    '        agents.push(s && s.cwd ? merge(a, { cwd: s.cwd, missing: false }) : merge(a, { missing: false }))',
    '      }',
  ].join('\n'),
  [
    '      const listOk = sessRes.ok === true',
    '      const agents = []',
    '      for (let i = 0; i < cur.agents.length; i++) {',
    '        const a = cur.agents[i]',
    '        const s = sessions[a.sessionId]',
    '        // A cached session can disappear (archived/deleted); keep the node but',
    '        // mark it so the UI can say it is no longer backed by a live session.',
    '        // Only judge that when the listing succeeded.',
    '        const gone = listOk && a.sessionId && !s',
    '        agents.push(s && s.cwd ? merge(a, { cwd: s.cwd, missing: gone }) : merge(a, { missing: gone }))',
    '      }',
  ].join('\n'),
  'guard missing detection',
)

fs.writeFileSync(p, c)
console.log('written')
