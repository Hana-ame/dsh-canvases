const fs = require('fs')
const p = '/tmp/acx/p14.client.js'
let c = fs.readFileSync(p, 'utf8')

function rep(from, to, label) {
  const n = c.split(from).length - 1
  if (n !== 1) throw new Error(label + ': expected 1 but found ' + n)
  c = c.replace(from, to)
  console.log('ok:', label)
}

// Restored agents carry no live cwd yet; reattach it from the session list, and
// drop entries whose session no longer exists so the cache cannot resurrect ghosts.
rep(
  '      const agents = cur.agents.map(function (a) {\n        const s = sessions[a.sessionId]\n        return s && s.cwd && !a.cwd ? merge(a, { cwd: s.cwd }) : a\n      })',
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
  'reattach cwd / mark missing',
)

fs.writeFileSync(p, c)
console.log('written')
