const fs = require('fs')
const p = '/tmp/acx/u.client.js'
let c = fs.readFileSync(p, 'utf8')

function rep(from, to, label) {
  const n = c.split(from).length - 1
  if (n !== 1) throw new Error(label + ': expected 1 but found ' + n)
  c = c.replace(from, to)
  console.log('ok:', label)
}

// Remove the unused helpers introduced earlier.
rep(
  [
    '      function selectAgent(a) {',
    '        store.set({ agentSel: [a.id], activeAgentId: a.id })',
    '        openInspector(a)',
    '      }',
    '      function selectFile(f) {',
    '        toggleFile(f.path)',
    '        if (touchMode) setInfo({ kind: "file", path: f.path })',
    '      }',
  ].join('\n'),
  '',
  'drop unused helpers',
)

// Track the pressed agent id explicitly instead of inferring it from activeAgentId.
rep(
  [
    '        const canDrag = store.get().mode === \'agent\'',
    '        const p = point(e)',
    '        dragRef.current = canDrag',
    '          ? { id: agent.id, dx: p.x - agent.x, dy: p.y - agent.y, moved: false, x0: p.x, y0: p.y }',
    '          : null',
    '        if (canDrag) setDraggingId(agent.id)',
  ].join('\n'),
  [
    '        const canDrag = store.get().mode === \'agent\'',
    '        const p = point(e)',
    '        pressedAgentRef.current = agent.id',
    '        dragRef.current = canDrag',
    '          ? { id: agent.id, dx: p.x - agent.x, dy: p.y - agent.y, moved: false, x0: p.x, y0: p.y }',
    '          : null',
    '        if (canDrag) setDraggingId(agent.id)',
  ].join('\n'),
  'track pressed agent',
)

rep(
  [
    '        if (d === null) {',
    '          // A click (no drag possible in file mode) opens the inspector.',
    '          const st2 = store.get()',
    '          const a2 = findAgent(st2.agents, st2.activeAgentId)',
    '          if (a2) openInspector(a2)',
    '          return',
    '        }',
    '        setDraggingId(null)',
    '        if (!d.moved) {',
    '          const st2 = store.get()',
    '          const a2 = findAgent(st2.agents, d.id) || findAgent(st2.agents, st2.activeAgentId)',
    '          if (a2) openInspector(a2)',
    '        }',
  ].join('\n'),
  [
    '        const pressedId = pressedAgentRef.current',
    '        pressedAgentRef.current = null',
    '        if (d !== null) {',
    '          setDraggingId(null)',
    '          if (d.moved) return',
    '        }',
    '        // A click selects the node and opens its editor; a drag only moves it.',
    '        const st2 = store.get()',
    '        const a2 = findAgent(st2.agents, (d && d.id) || pressedId)',
    '        if (a2) openInspector(a2)',
  ].join('\n'),
  'explicit click path',
)

rep(
  '      const fileDragRef = React.useRef(null)',
  '      const fileDragRef = React.useRef(null)\n      const pressedAgentRef = React.useRef(null)',
  'pressed ref',
)

fs.writeFileSync(p, c)
console.log('written')
