// ---------------------------------------------------------------------------
// Agent Canvas - client half.
//
// The UI itself is ~120 KB of plain JavaScript. It is served by this package's
// HOST half (`canvas-source`) and evaluated here, so the Package definition stays
// small enough to define, review and re-verify quickly, and a one-line UI fix
// does not require re-emitting the entire UI through a package parameter.
//
// The evaluated source is the exact file the gate suite executes. If it cannot be
// loaded we register a VISIBLE error panel instead of leaving the slot empty -
// a half-shipped package once silently erased this whole panel, and a blank
// panel is the one failure that must never happen again.
// ---------------------------------------------------------------------------
let real = null
let loadError = null
try {
  const res = await host.call('canvas-source', {})
  if (!res || res.ok !== true || typeof res.src !== 'string' || res.src.length === 0) {
    const why = res && res.error ? String(res.error) : 'host returned no source'
    throw new Error(why)
  }
  const build = new Function(
    'React', 'console', 'styles', 'host', 'harness',
    'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'fetch', 'require',
    'process', 'Buffer',
    res.src,
  )
  const made = build(
    React, console, styles, host, harness,
    undefined, undefined, undefined, undefined, undefined, undefined,
    undefined, undefined,
  )
  if (!made || typeof made.apply !== 'function') throw new Error('UI source did not return a plugin')
  real = made
} catch (e) {
  loadError = String((e && e.message) || e)
}

if (real !== null) return real

// ---- degraded mode: the panel is still registered, and it says what went wrong ----
const h = React.createElement
return {
  apply(ctx) {
    const slots = ctx.get('slots')
    if (slots === undefined || typeof slots.register !== 'function') return
    const render = function () {
      return h('div', { style: { padding: '16px', font: '13px/1.6 sans-serif' } },
        h('b', null, 'Agent Canvas 无法加载前端源码'),
        h('div', { style: { marginTop: '8px', color: '#d54941', whiteSpace: 'pre-wrap' } }, String(loadError)),
        h('div', { style: { marginTop: '8px', opacity: '.75' } },
          'Host 会依次尝试这些路径：/tmp/acx/v21.client.js、/home/lumin/.dsh/agent-canvas/ui.js'),
      )
    }
    slots.inject('main', function () {
      slots.register({ name: 'main', key: 'agent-canvas' }, render)
    })
  },
}
