const fs = require('fs')
const p = '/tmp/acx/u.client.js'
let c = fs.readFileSync(p, 'utf8')

function rep(from, to, label) {
  const n = c.split(from).length - 1
  if (n !== 1) throw new Error(label + ': expected 1 but found ' + n)
  c = c.replace(from, to)
  console.log('ok:', label)
}

// formErr/setFormErr still serve the project-session form; the agent-form-only
// state is dead now that the inspector owns editing.
rep(
  [
    "      const f2 = React.useState('')",
    '      const formMission = f2[0]',
    '      const setFormMission = f2[1]',
    "      const f3 = React.useState('')",
    '      const formCwd = f3[0]',
    '      const setFormCwd = f3[1]',
    "      const f4 = React.useState('')",
    '      const formPreset = f4[0]',
    '      const setFormPreset = f4[1]',
    '      const f5 = React.useState(null)',
    '      const formErr = f5[0]',
    '      const setFormErr = f5[1]',
    '      const f6 = React.useState(false)',
    '      const formBusy = f6[0]',
    '      const setFormBusy = f6[1]',
    '      const f10 = React.useState(0)',
    '      const elapsed = f10[0]',
    '      const setElapsed = f10[1]',
  ].join('\n'),
  [
    '      const f5 = React.useState(null)',
    '      const formErr = f5[0]',
    '      const setFormErr = f5[1]',
  ].join('\n'),
  'drop dead agent-form state',
)

// The elapsed-time effect only existed for the removed create button.
rep(
  [
    '      React.useEffect(function () {',
    '        if (!formBusy) { setElapsed(0); return undefined }',
    '        const started = Date.now()',
    "        const timer = ctx.get('timer')",
    '        let dispose = null',
    "        if (timer !== undefined && typeof timer.interval === 'function') {",
    '          dispose = timer.interval(function () { setElapsed(Math.round((Date.now() - started) / 1000)) }, 1000)',
    '        }',
    '        return function () { if (dispose) dispose() }',
    '      }, [formBusy])',
    '      React.useEffect(function () {',
  ].join('\n'),
  '      React.useEffect(function () {',
  'drop elapsed effect',
)

fs.writeFileSync(p, c)
console.log('written')
