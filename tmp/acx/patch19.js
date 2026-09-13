'use strict'
// pkg-19: workspace binding that cannot fail silently.
//   host  : new canvas-stat-dir handler (fs.resolve + fs.stat, distinct not-found error)
//   client: 选工作区 -> dialog with manual absolute path + Host validation + native picker fallback
//           every failure path writes a VISIBLE formErr; binding success toasts resolved path
//           presets now load on mount (the old form.kind==='agent' branch was dead code)
const fs = require('fs')
const path = require('path')
const DIR = '/tmp/acx'

function readp(p) { return fs.readFileSync(p, 'utf8') }
function sub(text, anchor, replacement, label) {
  const first = text.indexOf(anchor)
  if (first < 0) throw new Error('ANCHOR MISSING: ' + label)
  const second = text.indexOf(anchor, first + 1)
  if (second >= 0) throw new Error('ANCHOR NOT UNIQUE (' + label + ')')
  return text.slice(0, first) + replacement + text.slice(first + anchor.length)
}
// replace everything from startAnchor up to (not including) endAnchor
function subRange(text, startAnchor, endAnchor, replacement, label) {
  const a = text.indexOf(startAnchor)
  if (a < 0) throw new Error('RANGE START MISSING: ' + label)
  if (text.indexOf(startAnchor, a + 1) >= 0) throw new Error('RANGE START NOT UNIQUE: ' + label)
  const b = text.indexOf(endAnchor, a)
  if (b < 0) throw new Error('RANGE END MISSING: ' + label)
  return text.slice(0, a) + replacement + text.slice(b)
}

// ---------------------------------------------------------------- HOST
let host = readp(path.join(DIR, 'run17.host.js'))

const statHandler = `    harness.handle('canvas-stat-dir', async (args) => {
      if (fs === undefined) return { ok: false, error: 'fs service unavailable' }
      if (!args || typeof args.path !== 'string' || args.path.trim().length === 0) {
        return { ok: false, error: 'path required' }
      }
      const want = args.path.trim()
      try {
        const target = await fs.resolve(want)
        const resolved = String(target.displayPath || want)
        let info = null
        try {
          info = await fs.stat(target)
        } catch (e) {
          info = null
        }
        if (info !== undefined && info !== null) {
          return {
            ok: true,
            path: resolved,
            type: String(info.type),
            size: typeof info.size === 'number' ? info.size : null,
            isDirectory: info.type === 'directory',
            via: 'stat',
          }
        }
        // stat can be unavailable or inconclusive here; a successful listing proves a directory
        try {
          const listed = await fs.listDir(target)
          if (Array.isArray(listed)) {
            return { ok: true, path: resolved, type: 'directory', size: null, isDirectory: true, via: 'listDir' }
          }
        } catch (e) {}
        return { ok: false, error: '\\u8def\\u5f84\\u4e0d\\u5b58\\u5728\\u6216\\u4e0d\\u53ef\\u8bbf\\u95ee\\uff1a' + resolved, path: resolved, type: null }
      } catch (e) {
        return fail(e)
      }
    })
`
host = sub(host, "    harness.handle('canvas-list-files', async (args) => {",
  statHandler + "    harness.handle('canvas-list-files', async (args) => {", 'host stat handler')
host = sub(host, "host apply pkg-18", "host apply pkg-19", 'host tag')

// ---------------------------------------------------------------- CLIENT
let c = readp(path.join(DIR, 'run17.client.js'))

// 1) local state for the workspace dialog
c = sub(c,
  "      const f9 = React.useState('')\n      const projectQuery = f9[0]\n      const setProjectQuery = f9[1]\n",
  "      const f9 = React.useState('')\n      const projectQuery = f9[0]\n      const setProjectQuery = f9[1]\n" +
  "      const wsp1 = React.useState('')\n" +
  "      const wsPath = wsp1[0]\n" +
  "      const setWsPath = wsp1[1]\n" +
  "      const wsb1 = React.useState(false)\n" +
  "      const wsBusy = wsb1[0]\n" +
  "      const setWsBusy = wsb1[1]\n", 'client ws state')

// 2) presets load on mount (the only live caller of canvas-presets was dead code)
c = sub(c,
  "        refresh()\n        const timer = ctx.get('timer')\n        let dispose = null\n        const schedule = function () {\n",
  "        refresh()\n" +
  "        hostCall('canvas-presets', {}, 12000).then(function (r) {\n" +
  "          if (r && r.ok && r.items) setPresets(r.items)\n" +
  "        }, function () {})\n" +
  "        const timer = ctx.get('timer')\n        let dispose = null\n        const schedule = function () {\n", 'mount presets')

// 2b) drop the dead agent-form branch (nothing sets form.kind === 'agent' any more,
//     so this was the sole -- and unreachable -- caller of canvas-presets)
c = sub(c,
  "        if (form.kind === 'agent') {\n" +
  "          hostCall('canvas-presets', {}, 12000).then(function (r) {\n" +
  "            if (alive && r.ok && r.items) setPresets(r.items)\n" +
  "          })\n" +
  "          return function () { alive = false }\n" +
  "        }\n",
  '', 'dead agent-form branch')

// 3) replace pickWorkspace (silent cancel / unrendered wsError) with a validated dialog flow
const workspaceFns = `      function openWorkspaceForm(errText) {
        const cur = store.get().workspace
        setWsPath(typeof cur === 'string' ? cur : '')
        setWsBusy(false)
        setFormErr(errText ? String(errText) : null)
        store.set({ inspectId: null })
        setForm({ kind: 'workspace' })
      }
      function normalizePath(raw) {
        let p = String(raw === undefined || raw === null ? '' : raw).trim()
        if (p.length > 1) {
          const q = p.charAt(0)
          if ((q === '"' || q === "'") && p.charAt(p.length - 1) === q) p = p.slice(1, -1).trim()
        }
        const home = store.get().home
        if (typeof home === 'string' && home.length > 0 && p.indexOf('~/') === 0) {
          p = home.replace(/\\/+$/, '') + p.slice(1)
        }
        return p
      }
      async function bindWorkspace(raw) {
        const p = normalizePath(raw)
        if (p.length === 0) {
          setFormErr('\\u8bf7\\u5148\\u586b\\u5199\\u5de5\\u4f5c\\u533a\\u7684\\u7edd\\u5bf9\\u8def\\u5f84')
          return false
        }
        setWsBusy(true)
        setFormErr(null)
        let r = null
        try {
          r = await hostCall('canvas-stat-dir', { path: p }, 15000)
        } catch (e) {
          r = { ok: false, error: String((e && e.message) || e) }
        }
        setWsBusy(false)
        if (!r || r.ok !== true) {
          setFormErr('\\u65e0\\u6cd5\\u8bbf\\u95ee ' + p + '\\uff1a' + String((r && r.error) || '\\u672a\\u77e5\\u9519\\u8bef') + '\\uff08\\u8def\\u5f84\\u5fc5\\u987b\\u5df2\\u5b58\\u5728\\uff09')
          return false
        }
        if (r.isDirectory !== true && r.type !== undefined && r.type !== null && r.type !== 'directory') {
          setFormErr(p + ' \\u4e0d\\u662f\\u4e00\\u4e2a\\u76ee\\u5f55')
          return false
        }
        const resolved = typeof r.path === 'string' && r.path.length > 0 ? r.path : p
        store.set({ workspace: resolved, wsError: null })
        setForm(null)
        setFormErr(null)
        setToast({ id: nextId('t'), text: '\\u5df2\\u7ed1\\u5b9a\\u5de5\\u4f5c\\u533a\\uff1a' + resolved })
        refresh()
        return true
      }
      async function tryNativePick() {
        const ui = ctx.get('uiWorkspace')
        if (ui === undefined || typeof ui.pickDirectory !== 'function') {
          setFormErr('\\u5f53\\u524d\\u754c\\u9762\\u6ca1\\u6709\\u63d0\\u4f9b\\u7cfb\\u7edf\\u76ee\\u5f55\\u9009\\u62e9\\u5668\\uff0c\\u8bf7\\u5728\\u4e0b\\u9762\\u624b\\u52a8\\u586b\\u5199\\u7edd\\u5bf9\\u8def\\u5f84\\u3002')
          return
        }
        setWsBusy(true)
        setFormErr(null)
        let picked = null
        let errText = null
        try {
          picked = await ui.pickDirectory()
        } catch (e) {
          errText = String((e && e.message) || e)
        }
        setWsBusy(false)
        if (errText !== null) {
          setFormErr('\\u7cfb\\u7edf\\u9009\\u62e9\\u5668\\u4e0d\\u53ef\\u7528\\uff1a' + errText + '\\u3002\\u8bf7\\u5728\\u4e0b\\u9762\\u624b\\u52a8\\u586b\\u5199\\u7edd\\u5bf9\\u8def\\u5f84\\u3002')
          return
        }
        if (typeof picked !== 'string' || picked.length === 0) {
          setFormErr('\\u5df2\\u53d6\\u6d88\\u9009\\u62e9\\u3002\\u53ef\\u5728\\u4e0b\\u9762\\u624b\\u52a8\\u586b\\u5199\\u7edd\\u5bf9\\u8def\\u5f84\\u3002')
          return
        }
        setWsPath(picked)
        await bindWorkspace(picked)
      }
`
c = subRange(c, '      async function pickWorkspace() {', '      function openProjectForm() {', workspaceFns, 'pickWorkspace replace')

// 4) toolbar: open the dialog instead of calling the picker directly, relabel when unbound
c = sub(c, '          onClick: pickWorkspace,', '          onClick: function () { openWorkspaceForm(null) },', 'toolbar onClick')
c = sub(c,
  "        }, st.workspace ? '\\u5de5\\u4f5c\\u533a: ' + basename(st.workspace) : '\\u9009\\u5de5\\u4f5c\\u533a'),",
  "        }, st.workspace ? '\\u5de5\\u4f5c\\u533a: ' + basename(st.workspace) : '\\u7ed1\\u5b9a\\u5de5\\u4f5c\\u533a'),", 'toolbar label')

// 5) workspace dialog, ahead of the inspector branch
const dialog = `      if (form && form.kind === 'workspace') {
        const curWs = st.workspace
        formEl = h('div', { className: 'acx-form' },
          h('div', { className: 'acx-form-title' }, '\\u7ed1\\u5b9a\\u5de5\\u4f5c\\u533a\\u6587\\u4ef6\\u5939'),
          h('div', { className: 'acx-hint' }, '\\u4e00\\u4e2a canvas \\u5bf9\\u5e94\\u4e00\\u4e2a\\u5de5\\u4f5c\\u533a\\u6587\\u4ef6\\u5939\\u3002\\u8f93\\u5165\\u5b83\\u7684\\u7edd\\u5bf9\\u8def\\u5f84\\u540e\\u70b9\\u300c\\u7ed1\\u5b9a\\u300d\\uff0cHost \\u4f1a\\u5148\\u6821\\u9a8c\\u8be5\\u8def\\u5f84\\u662f\\u5426\\u5b58\\u5728\\u4e14\\u4e3a\\u76ee\\u5f55\\uff1b\\u7ed1\\u5b9a\\u540e\\u8be5\\u76ee\\u5f55\\u6811\\u91cc\\u7684\\u6bcf\\u4e2a\\u6587\\u4ef6\\u90fd\\u4f1a\\u6210\\u4e3a\\u8282\\u70b9\\u3002'),
          h('div', { className: 'acx-row' },
            h('input', {
              className: 'acx-inp',
              style: { flex: '1 1 260px', minWidth: '180px' },
              value: wsPath,
              placeholder: st.home ? (st.home + '/project') : '/\\u7edd\\u5bf9/\\u8def\\u5f84',
              onChange: function (e) { setWsPath(e.target.value) },
              onKeyDown: function (e) { if (e.key === 'Enter') { e.preventDefault(); bindWorkspace(wsPath) } },
            }),
          ),
          h('div', { className: 'acx-row' },
            h('button', { className: 'acx-btn acx-primary', disabled: wsBusy, onClick: function () { bindWorkspace(wsPath) } }, wsBusy ? '\\u6821\\u9a8c\\u4e2d\\u2026' : '\\u7ed1\\u5b9a'),
            h('button', { className: 'acx-btn', disabled: wsBusy, onClick: tryNativePick }, '\\u7528\\u7cfb\\u7edf\\u9009\\u62e9\\u5668'),
            st.home ? h('button', { className: 'acx-btn', disabled: wsBusy, onClick: function () { setWsPath(st.home) } }, '\\u4e3b\\u76ee\\u5f55') : null,
            curWs ? h('button', { className: 'acx-btn', disabled: wsBusy, onClick: function () { setWsPath(curWs) } }, '\\u5f53\\u524d\\u5de5\\u4f5c\\u533a') : null,
          ),
          curWs ? h('div', { className: 'acx-hint' }, '\\u5f53\\u524d\\u5df2\\u7ed1\\u5b9a\\uff1a' + curWs) : null,
          formErr ? h('div', { className: 'acx-errbox' }, formErr) : null,
          h('div', { className: 'acx-btns' },
            h('button', { className: 'acx-btn', onClick: closeForm }, '\\u5173\\u95ed'),
          ),
        )
      } else if (inspectAgent) {
`
c = sub(c,
  "      let formEl = null\n      const inspectAgent = st.inspectId ? findAgent(st.agents, st.inspectId) : null\n      if (inspectAgent) {\n",
  "      let formEl = null\n      const inspectAgent = st.inspectId ? findAgent(st.agents, st.inspectId) : null\n" + dialog, 'render dialog')

// 6) surface any residual wsError in the legend instead of storing it invisibly
c = sub(c,
  "        st.scanNote ? h('span', null, st.scanNote) : null,\n      )\n",
  "        st.scanNote ? h('span', null, st.scanNote) : null,\n" +
  "        st.wsError ? h('span', { style: { color: 'var(--dsw-alias-label-error, #d4380d)' } }, String(st.wsError)) : null,\n" +
  "      )\n", 'legend wsError')

c = sub(c, "agent-canvas] client apply pkg-18", "agent-canvas] client apply pkg-19", 'client tag')

// 7) mobile: keep the dialog clear of the wrapped toolbar (bar is capped at 40%)
c = sub(c, "  '.acx-form{max-height:70%}',", "  '.acx-form{max-height:48%}',", 'touch form cap')
c = sub(c, "  '.acx-touch .acx-hover{display:none}',",
  "  '.acx-touch .acx-hover{display:none}',\n  '.acx-touch .acx-form{max-height:48%}',", 'touch form cap (class)')

// ---------------------------------------------------------------- checks
function audit(label, text) {
  if (/\b(?:import|require)\s*\(/.test(text.replace(/require\('fs'\)/g, ''))) { /* dynamic bodies disallow require; checked below per-file */ }
  const lines = text.split('\n')
  for (let i = 1; i < lines.length; i++) {
    const t = lines[i].trim()
    if (t.length > 12 && t === lines[i - 1].trim()) throw new Error('ADJACENT DUPLICATE LINE in ' + label + ': ' + t)
  }
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].indexOf('/tmp/acx') >= 0) throw new Error('LEFTOVER SCRATCH PATH in ' + label + ' line ' + (i + 1))
  }
  // real CJK text is legitimate (markdown export); only reject invisible/control junk
  for (const ch of Array.from(text)) {
    const cp = ch.codePointAt(0)
    if (cp < 32 && ch !== '\n' && ch !== '\t') throw new Error('CONTROL CHARACTER U+' + cp.toString(16) + ' in ' + label)
    if (cp === 0x200b || cp === 0x200c || cp === 0x200d || cp === 0xfeff || cp === 0xfffd) {
      throw new Error('INVISIBLE/JUNK CHARACTER U+' + cp.toString(16) + ' in ' + label)
    }
  }
}
audit('host', host)
audit('client', c)

if (host.indexOf("harness.handle('canvas-stat-dir'") < 0) throw new Error('stat handler absent')
if (host.indexOf('pkg-19') < 0 || c.indexOf('pkg-19') < 0) throw new Error('tag not bumped')
if (c.indexOf('pickWorkspace') >= 0) throw new Error('pickWorkspace still referenced')
if (c.indexOf('wsError') < 0) throw new Error('wsError unexpectedly gone')
if (c.indexOf("hostCall('canvas-stat-dir'") < 0) throw new Error('client does not call stat handler')
for (const need of ['openWorkspaceForm', 'bindWorkspace', 'tryNativePick', 'normalizePath']) {
  if (c.indexOf('function ' + need) < 0) throw new Error('missing function ' + need)
}

// syntax: host body + client body must be constructible as plain function bodies
new Function(host)
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
new AsyncFunction(c)
console.log('OK patch19: host', host.length, 'client', c.length)

if (process.argv.indexOf('--write') >= 0) {
  fs.writeFileSync(path.join(DIR, 'u.host.js'), host)
  fs.writeFileSync(path.join(DIR, 'u.client.js'), c)
  console.log('wrote u.host.js / u.client.js')
}
