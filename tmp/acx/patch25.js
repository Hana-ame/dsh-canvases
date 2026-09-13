'use strict'
// patch25:
//  A. agent settings move to a RIGHT-SIDE panel (右侧设置): the agent inspector is no
//     longer a bottom sheet; it lives in a right column above the chat dock.
//  B. entering the canvas auto-collapses the left sidebar (when it is expanded and the
//     viewport is wide) so the graph gets the room; a toolbar button toggles it back.
const fs = require('fs')
const C = '/tmp/acx/v21.client.js'
let c = fs.readFileSync(C, 'utf8')

function sub(from, to, label) {
  const n = c.split(from).length - 1
  if (n === 0) throw new Error('ANCHOR MISSING: ' + label)
  if (n > 1) throw new Error('ANCHOR NOT UNIQUE (' + n + '): ' + label)
  c = c.replace(from, to)
}

// ---------------- CSS: right column + settings panel ----------------
sub(
  "  '.acx-dock{position:absolute;top:96px;right:8px;bottom:8px;z-index:16;width:min(376px,46%);display:flex;flex-direction:column;min-height:0;border:1px solid var(--dsw-alias-border-l3,rgba(127,127,127,.35));border-radius:14px;background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-layer-2,transparent));box-shadow:0 12px 32px rgba(0,0,0,.28);overflow:hidden}',",
  `  // The right column holds the agent settings panel and the chat dock. It is a
  // transparent flex track: only its children take pointer events, so the empty
  // area under a short settings panel still lets the canvas be dragged.
  '.acx-right{position:absolute;top:96px;right:8px;bottom:8px;z-index:16;width:min(392px,48%);display:flex;flex-direction:column;gap:8px;min-height:0;pointer-events:none}',
  '.acx-right>*{pointer-events:auto}',
  '.acx-dock{flex:1 1 auto;display:flex;flex-direction:column;min-height:0;border:1px solid var(--dsw-alias-border-l3,rgba(127,127,127,.35));border-radius:14px;background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-layer-2,transparent));box-shadow:0 12px 32px rgba(0,0,0,.28);overflow:hidden}',
  '.acx-side{flex:0 1 auto;max-height:64%;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:8px;padding:12px;font-size:12px;border:1px solid var(--dsw-alias-border-l3,rgba(127,127,127,.35));border-radius:14px;background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-layer-2,transparent));box-shadow:0 12px 32px rgba(0,0,0,.28)}',`,
  'dock css -> right column',
)

sub(
  "  '.acx-dock{top:auto;left:8px;right:8px;bottom:8px;width:auto;height:min(52%,360px)}',",
  `  '.acx-right{top:auto;left:8px;right:8px;bottom:8px;width:auto;height:min(58%,420px)}',
  '.acx-side{max-height:70%}',`,
  'dock css media query',
)
sub("  '.acx-touch .acx-form{max-height:48%}',",
  "  '.acx-touch .acx-form{max-height:48%}',\n  '.acx-touch .acx-right{top:auto;left:8px;right:8px;bottom:8px;width:auto;height:min(56%,400px)}',",
  'touch right column')

// ---------------- settings panel instead of the bottom sheet ----------------
sub(
  "      let formEl = null\n      const inspectAgent = st.inspectId ? findAgent(st.agents, st.inspectId) : null",
  "      let formEl = null\n      let settingsPanel = null\n      const inspectAgent = st.inspectId ? findAgent(st.agents, st.inspectId) : null",
  'settingsPanel decl',
)

// turn the old inspectAgent formEl branch into the right-side settings panel
sub(
  "      } else if (inspectAgent) {\n        const options = [h('option', { key: '__default', value: '' }, '默认 preset')]",
  "      }\n      // 右侧设置：选中 agent 后，它的全部设置都在右栏，而不是底部弹层。\n      if (inspectAgent) {\n        const options = [h('option', { key: '__default', value: '' }, '默认 preset')]",
  'settings branch open',
)
sub(
  "        formEl = h('div', { className: 'acx-form' },\n          h('div', { className: 'acx-form-title' }, 'Agent ' + inspectAgent.name),",
  "        settingsPanel = h('div', { className: 'acx-side' },\n          h('div', { className: 'acx-sheet-head' },\n            h('b', null, 'Agent 设置'),\n            h('span', { className: 'acx-sm' }, inspectAgent.name),\n            h('button', { className: 'acx-btn', onClick: closeInspector }, '收起'),\n          ),",
  'settings panel head',
)
// close the settings branch before the project branch
sub(
  "            h('button', { className: 'acx-btn', onClick: closeInspector }, '完成'),\n          ),\n        )\n      } else if (form && form.kind === 'project') {",
  "            h('button', { className: 'acx-btn acx-primary', onClick: closeInspector }, '完成'),\n          ),\n        )\n      }\n      if (form && form.kind === 'project') {",
  'settings branch close',
)

// ---------------- mount the right column ----------------
sub(
  "        st.dock ? h(ChatDock, { touch: touchMode }) : null,\n        formEl,",
  "        (settingsPanel !== null || st.dock) ? h('div', { className: 'acx-right' }, settingsPanel, st.dock ? h(ChatDock, { touch: touchMode }) : null) : null,\n        formEl,",
  'right column mount',
)

// ---------------- auto-collapse the left sidebar on entry ----------------
sub(
  "      const canvasRef = React.useRef(null)",
  "      const canvasRef = React.useRef(null)\n      const rootRef = React.useRef(null)",
  'rootRef',
)
sub(
  "      return h('div', { className: touchMode ? 'acx-root acx-touch' : 'acx-root' },",
  "      return h('div', { ref: rootRef, className: touchMode ? 'acx-root acx-touch' : 'acx-root' },",
  'rootRef attach',
)

// the collapse helper + effect, hung next to the zoom helpers
sub(
  "      // ---- ZOOM -------------------------------------------------------------",
  `      // ---- LEFT SIDEBAR AUTO-COLLAPSE ---------------------------------------
      // ctx.layout only exposes a blind toggleSidebar(), so read the current state
      // from our OWN panel: the main column starts right after the sidebar, so its
      // left offset is the sidebar width. On a narrow frame the sidebar is an
      // overlay and our offset stays ~0, which correctly means "leave it alone".
      function sidebarLooksExpanded() {
        const el = rootRef.current
        if (!el || typeof el.getBoundingClientRect !== 'function') return false
        try {
          const r = el.getBoundingClientRect()
          return r.left > 120
        } catch (e) {
          return false
        }
      }
      function toggleLeftSidebar() {
        const layout = ctx.get('layout')
        if (layout === undefined || typeof layout.toggleSidebar !== 'function') {
          setToast({ id: nextId('t'), text: '当前界面没有提供左栏折叠接口' })
          return
        }
        try {
          layout.toggleSidebar()
        } catch (e) {
          setToast({ id: nextId('t'), text: String((e && e.message) || e) })
        }
      }
      // ---- ZOOM -------------------------------------------------------------`,
  'sidebar helpers',
)

// run the collapse once, when the panel mounts
sub(
  "        if (timer !== undefined && typeof timer.timeout === 'function') schedule()\n        return function () { stopped = true; if (dispose) dispose() }\n      }, [])",
  `        if (timer !== undefined && typeof timer.timeout === 'function') schedule()
        // 进入 canvas 时自动折叠左栏，把宽度让给图。只在左栏确实展开、且窗口足够宽时做一次。
        if (typeof window !== 'undefined' && (window.innerWidth || 0) >= 1024 && sidebarLooksExpanded()) {
          toggleLeftSidebar()
        }
        return function () { stopped = true; if (dispose) dispose() }
      }, [])`,
  'auto-collapse on mount',
)

// toolbar button
sub(
  "        h('button', { className: 'acx-btn', onClick: openProjectForm }, '投影会话'),",
  "        h('button', { className: 'acx-btn', title: '折叠/展开左侧栏，给画布让出宽度', onClick: toggleLeftSidebar }, '左栏'),\n        h('button', { className: 'acx-btn', onClick: openProjectForm }, '投影会话'),",
  'sidebar toggle button',
)

fs.writeFileSync(C, c)
console.log('patch25 ok:', c.length, 'bytes')
