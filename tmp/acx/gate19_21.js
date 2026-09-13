'use strict'
// pkg-19 gate: workspace binding can no longer fail silently.
const fs = require('fs')
// The shipped source stores CJK as literal UTF-8; un-escape any \uXXXX in it so
// assertions written against the escaped form keep testing the same intent.
const norm = function (s) {
  return s.replace(/[^\x00-\x7f]/g, function (ch) {
    return '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0')
  })
}
const c = norm(fs.readFileSync('/tmp/acx/v21.client.js', 'utf8'))
const h = norm(fs.readFileSync('/tmp/acx/v21.host.js', 'utf8'))



const checks = []
function check(name, ok) { checks.push([name, ok === true]) }
function re(name, pattern, text) { check(name, pattern.test(text)) }

// the whole binding flow, from the dialog opener up to the next unrelated function
const flowStart = c.indexOf('      async function bindWorkspace(')
const flowEnd = c.indexOf('      function openProjectForm(')
if (flowStart < 0 || flowEnd < flowStart) throw new Error('binding flow region not found')
const flow = c.slice(flowStart, flowEnd)

// returns inside the flow that are NOT adjacent to a visible error write
const flowLines = flow.split('\n')
const nakedReturns = []
for (let i = 0; i < flowLines.length; i++) {
  if (!/^\s*return\b/.test(flowLines[i])) continue
  let guarded = false
  for (let j = Math.max(0, i - 6); j < i; j++) if (flowLines[j].indexOf('setFormErr(') >= 0) guarded = true
  if (!guarded) nakedReturns.push(flowLines[i].trim())
}

// ---------------- host side
re('host registers canvas-stat-dir', /harness\.handle\('canvas-stat-dir'/, h)
re('stat uses fs.resolve', /canvas-stat-dir'[\s\S]{0,600}await fs\.resolve\(want\)/, h)
re('stat uses fs.stat', /canvas-stat-dir'[\s\S]{0,900}await fs\.stat\(target\)/, h)
re('stat returns only on a conclusive stat', /if \(info !== undefined && info !== null\) \{\s*\n\s*return \{/, h)
re('stat falls back to listDir as directory proof', /const listed = await fs\.listDir\(target\)[\s\S]{0,220}isDirectory: true, via: 'listDir'/, h)
re('stat reports a real error when both routes fail', /return \{ ok: false, error: '[^']*' \+ resolved, path: resolved, type: null \}/, h)
re('stat does not fail open on a stat throw', /try \{\s*\n\s*info = await fs\.stat\(target\)\s*\n\s*\} catch \(e\) \{\s*\n\s*info = null/, h)
re('stat reports isDirectory', /isDirectory: info\.type === 'directory'/, h)
re('stat rejects an empty path', /canvas-stat-dir'[\s\S]{0,300}args\.path\.trim\(\)\.length === 0/, h)

// ---------------- client: entry point
check('toolbar no longer calls the picker directly', c.indexOf('onClick: pickWorkspace') < 0)
re('toolbar opens the binding dialog', /onClick: function \(\) \{ openWorkspaceForm\(null\) \}/, c)
re('unbound toolbar label says bind-workspace', /'\\u7ed1\\u5b9a\\u5de5\\u4f5c\\u533a'\)/, c)

// ---------------- client: dialog
re('dialog state branch exists', /if \(form && form\.kind === 'workspace'\) \{/, c)
check('dialog renders before the inspector', c.indexOf("form.kind === 'workspace'") < c.indexOf("settingsPanel = h('div', { className: 'acx-side' }"))
re('dialog reuses the mobile sheet panel', /form\.kind === 'workspace'\) \{[\s\S]{0,200}className: 'acx-form'/, c)
re('dialog has a manual path input', /placeholder: st\.home \? \(st\.home \+ '\/project'\)/, c)
re('input is bound to wsPath', /value: wsPath,[\s\S]{0,300}setWsPath\(e\.target\.value\)/, c)
re('Enter submits the path', /e\.key === 'Enter'[\s\S]{0,80}bindWorkspace\(wsPath\)/, c)
re('dialog has a bind button calling bindWorkspace', /disabled: wsBusy, onClick: function \(\) \{ bindWorkspace\(wsPath\) \}/, c)
re('dialog has a native-picker fallback button', /onClick: tryNativePick \}/, c)
re('dialog can prefill home', /setWsPath\(st\.home\)/, c)
re('dialog shows the current binding', /'\\u5f53\\u524d\\u5df2\\u7ed1\\u5b9a\\uff1a' \+ curWs/, c)
re('dialog renders formErr inline', /formErr \? h\('div', \{ className: 'acx-errbox' \}, formErr\) : null/, c)
re('dialog is dismissible', /form\.kind === 'workspace'[\s\S]{0,7000}onClick: closeForm/, c)

// ---------------- client: validation
re('bind calls canvas-stat-dir', /hostCall\('canvas-stat-dir', \{ path: p \}, 15000\)/, c)
re('bind guards the hostCall throw', /catch \(e\) \{\s*\n\s*r = \{ ok: false, error: String\(\(e && e\.message\) \|\| e\) \}/, c)
re('bind refuses empty input visibly', /p\.length === 0\) \{\s*\n\s*setFormErr\(/, c)
re('bind surfaces host failure with the path', /setFormErr\('\\u65e0\\u6cd5\\u8bbf\\u95ee ' \+ p \+/, c)
re('bind refuses non-directories visibly', /r\.isDirectory !== true[\s\S]{0,120}setFormErr\(p \+/, c)
re('bind prefers the host-resolved path', /typeof r\.path === 'string' && r\.path\.length > 0 \? r\.path : p/, c)
re('bind commits the workspace', /store\.set\(\{ workspace: resolved, wsError: null \}\)/, c)
re('bind closes the dialog on success', /store\.set\(\{ workspace: resolved, wsError: null \}\)[\s\S]{0,300}setForm\(null\)/, c)
re('bind toasts the resolved path', /setToast\(\{ id: nextId\('t'\), text: '\\u5df2\\u7ed1\\u5b9a\\u5de5\\u4f5c\\u533a\\uff1a' \+ resolved \}\)/, c)
re('bind rescans after binding', /store\.set\(\{ workspace: resolved[\s\S]{0,500}refresh\(\)/, c)
re('bind expands ~/ via home', /p\.indexOf\('~\/'\) === 0[\s\S]{0,160}home\.replace/, c)
re('bind strips pasted quotes', /q === '"' \|\| q === "'"/, c)

// ---------------- client: no silent failure
re('missing picker is visible, not silent', /typeof ui\.pickDirectory !== 'function'\) \{\s*\n\s*setFormErr\(/, c)
re('picker throw is visible', /errText = String\(\(e && e\.message\) \|\| e\)[\s\S]{0,600}setFormErr\('/, c)
re('picker throw falls back to the in-app browser', /errText = String\(\(e && e\.message\) \|\| e\)[\s\S]{0,900}await openBrowse\(wsPath \|\| store\.get\(\)\.home \|\| '\/'/, c)
re('picker cancel is visible', /typeof picked !== 'string' \|\| picked\.length === 0\) \{\s*\n\s*setFormErr\(/, c)
re('native pick revalidates through bind', /setWsPath\(picked\)\s*\n\s*await bindWorkspace\(picked\)/, c)
check('no return exits the binding flow silently', nakedReturns.length === 0)
re('binding flow has a success return after clearing the error', /setFormErr\(null\)[\s\S]{0,300}return true/, c)
check('at least 6 visible error writes in the flow', (flow.match(/setFormErr\(/g) || []).length >= 6)
re('wsError is rendered, not merely stored', /st\.wsError \? h\('span'/, c)
re('wsError is cleared on a successful bind', /workspace: resolved, wsError: null/, c)
re('wsError still cleared by clear-canvas', /activeAgentId: null, workspace: null, fileSel: \[\], files: \[\], wsError: null/, c)

// ---------------- client: presets bug
re('mount effect fetches presets', /hostCall\('canvas-presets', \{\}, 12000\)\.then\(function \(r\) \{\s*\n\s*if \(r && r\.ok && r\.items\) setPresets\(r\.items\)/, c)
check('mount preset fetch precedes the poll timer', c.indexOf("hostCall('canvas-presets', {}, 12000)") < c.indexOf("let dispose = null\n        const schedule"))
re('mount preset fetch cannot reject unhandled', /setPresets\(r\.items\)\s*\n\s*\}, function \(\) \{\}\)/, c)
check('preset fetch failure does not clear existing presets', !/setPresets\(\[\]\)/.test(c))
check('no dead agent-form preset fetch remains', c.indexOf("if (form.kind === 'agent')") < 0)

// ---------------- regression guards
check('pickDirectory still available as an option', /ui\.pickDirectory/.test(c))
check('binding is never optimistic about the path', !/store\.set\(\{ workspace: p/.test(c))

let bad = 0
for (const pair of checks) {
  if (!pair[1]) { console.log('FAIL ' + pair[0]); bad++ } else console.log('PASS ' + pair[0])
}
console.log(bad === 0 ? 'ALL PASS (' + checks.length + ')' : 'FAILURES ' + bad)
console.log('naked returns in flow: ' + JSON.stringify(nakedReturns))
process.exit(bad === 0 ? 0 : 1)
