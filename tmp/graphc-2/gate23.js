'use strict'
// gate23: the loader path. The shipped client half is a small loader that asks the
// HOST half for the UI source (handler `canvas-source`) and evaluates it. This gate
// proves that path returns a working plugin that registers the three slots, so a
// mistake here cannot silently blank the panel the way a host-only package did.
const fs = require('fs')
const src = fs.readFileSync('/tmp/acx/loader.client.js', 'utf8')
const uiSrc = fs.readFileSync('/tmp/acx/v21.client.js', 'utf8')
const hostSrc = fs.readFileSync('/tmp/acx/v21.host.js', 'utf8')

const checks = []
const check = (n, ok) => checks.push([n, ok === true])

// ---------------- minimal React with hook state ----------------
const hookStore = new WeakMap()
const hookStack = []
function topFrame() { return hookStack[hookStack.length - 1] }
let renders = 0
const React = {
  createElement: function (type, props) {
    const children = Array.prototype.slice.call(arguments, 2)
    if (typeof type === 'function') {
      renders += 1
      const p = {}
      if (props) for (const k in props) p[k] = props[k]
      if (children.length > 0) p.children = children
      let cells = hookStore.get(type)
      if (cells === undefined) { cells = []; hookStore.set(type, cells) }
      hookStack.push({ cells: cells, i: 0 })
      try { return type(p) } finally { hookStack.pop() }
    }
    const node = { type: type, props: props || {}, children: children }
    if (node.props.ref && typeof node.props.ref === 'object' && 'current' in node.props.ref) {
      node.props.ref.current = { getContext: function () { return null }, clientWidth: 900, clientHeight: 600, style: {}, dataset: {}, width: 900, height: 600, getBoundingClientRect: function () { return { left: 0, top: 0 } }, addEventListener: function () {}, removeEventListener: function () {} }
    }
    return node
  },
  useState: function (init) { const f = topFrame(); const i = f.i++; if (!(i in f.cells)) f.cells[i] = typeof init === 'function' ? init() : init; const c = f.cells; return [c[i], function (v) { c[i] = typeof v === 'function' ? v(c[i]) : v }] },
  useRef: function (init) { const f = topFrame(); const i = f.i++; if (!(i in f.cells)) f.cells[i] = { current: typeof init === 'function' ? init() : init }; return f.cells[i] },
  useEffect: function (fn) { if (typeof fn === 'function') fn() },
  useMemo: function (fn, deps) {
    const f = topFrame()
    const i = f.i++
    if (!(i in f.cells)) {
      let v
      try { v = fn() } catch (e) { v = undefined }
      f.cells[i] = { deps: deps, value: v }
      return v
    }
    const cell = f.cells[i]
    let changed = true
    if (deps && cell.deps && cell.deps.length === deps.length) {
      changed = false
      for (let k = 0; k < deps.length; k++) if (deps[k] !== cell.deps[k]) { changed = true; break }
    }
    if (changed) { cell.deps = deps; cell.value = fn() }
    return cell.value
  },
  useCallback: function (fn) { return fn },
}

// ---------------- mock host / ctx ----------------
const registered = {}
const slots = {
  inject: function (n, cb) { if (typeof cb === 'function') cb() },
  register: function (spec, render) { registered[spec.name] = render },
}
const timer = { timeout: function (a) { return typeof a === 'function' ? function () {} : new Promise(function () {}) }, interval: function () { return function () {} } }
const ctx = {
  get: function (name) {
    if (name === 'slots') return slots
    if (name === 'timer') return timer
    if (name === 'uiWorkspace') return { listDirectory: function () { return Promise.resolve({ home: '/tmp' }) }, pickDirectory: function () { return Promise.resolve(null) } }
    if (name === 'sessions') return { open: function () {}, binding: function () { return null } }
    if (name === 'layout') return { selectPanel: function () {} }
    return undefined
  },
  effect: function (fn) { if (typeof fn === 'function') fn(); return function () {} },
  on: function () { return function () {} },
}
const served = { count: 0 }
const host = {
  call: function (method) {
    if (method === 'canvas-source') { served.count += 1; return Promise.resolve({ ok: true, src: uiSrc, bytes: uiSrc.length }) }
    return Promise.resolve({ ok: false, error: 'unmocked ' + method })
  },
}
const styles = { insert: function () { return function () {} } }
const win = { devicePixelRatio: 1, matchMedia: function () { return { matches: false, addEventListener: function () {}, removeEventListener: function () {} } }, addEventListener: function () {}, removeEventListener: function () {}, requestAnimationFrame: function (fn) { if (typeof fn === 'function') fn(); return 1 }, getComputedStyle: function () { return { getPropertyValue: function () { return '' } } }, setTimeout: function () {}, URL: { createObjectURL: function () { return 'blob:x' }, revokeObjectURL: function () {} } }
const doc = { createElement: function () { return { style: {}, dataset: {}, appendChild: function () {}, click: function () {}, remove: function () {} } }, body: { appendChild: function () {}, removeChild: function () {} } }
const ls = { getItem: function () { return null }, setItem: function () {}, removeItem: function () {} }
const harnessTrap = new Proxy({}, { get: function () { throw new Error('harness is host-only') } })

;(async function () {
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
  let plugin = null
  try {
    // mirror the runner: the loader body runs inside an async IIFE
    const factory = new AsyncFunction(
      'React', 'console', 'styles', 'host', 'harness', 'window', 'document',
      'localStorage', 'Blob', 'URL', 'setTimeout', 'ResizeObserver', 'requestAnimationFrame',
      'return (async () => {\n' + src + '\n})()',
    )
    plugin = await factory(React, console, styles, host, harnessTrap, win, doc, ls, function () {}, win.URL, function () {}, function () {}, win.requestAnimationFrame)
    check('loader evaluated to a plugin object', !!(plugin && typeof plugin === 'object'))
    check('loader returned apply()', !!(plugin && typeof plugin.apply === 'function'))
    check('loader asked the host for the UI source', served.count === 1)
  } catch (e) {
    console.log('LOADER ERROR: ' + (e && e.message))
    check('loader evaluated to a plugin object', false)
    check('loader returned apply()', false)
    check('loader asked the host for the UI source', false)
  }

  if (plugin && typeof plugin.apply === 'function') {
    try {
      plugin.apply(ctx)
      check('applying the loaded plugin registers the main slot', typeof registered.main === 'function')
      check('applying the loaded plugin registers the sidebar slot', typeof registered['sidebar.panellist'] === 'function')
      check('applying the loaded plugin registers the tool view', typeof registered['tool.view.cordis'] === 'function')
      const tree = registered.main()
      check('the loaded UI renders without throwing', !!(tree && tree.type))
      check('the loaded UI has a graph canvas', JSON.stringify(tree).indexOf('acx-graph') >= 0)
    } catch (e) {
      console.log('APPLY ERROR: ' + (e && e.message))
      check('applying the loaded plugin registers the main slot', false)
      check('applying the loaded plugin registers the sidebar slot', false)
      check('applying the loaded plugin registers the tool view', false)
      check('the loaded UI renders without throwing', false)
      check('the loaded UI has a graph canvas', false)
    }
  } else {
    check('applying the loaded plugin registers the main slot', false)
    check('applying the loaded plugin registers the sidebar slot', false)
    check('applying the loaded plugin registers the tool view', false)
    check('the loaded UI renders without throwing', false)
    check('the loaded UI has a graph canvas', false)
  }

  // ---------------- degraded mode: host cannot serve the source ----------------
  {
    const registered2 = {}
    const slots2 = {
      inject: function (n, cb) { if (typeof cb === 'function') cb() },
      register: function (spec, render) { registered2[spec.name] = render },
    }
    const ctx2 = { get: function (n) { return n === 'slots' ? slots2 : undefined }, effect: function () {}, on: function () { return function () {} } }
    const host2 = { call: function () { return Promise.resolve({ ok: false, error: 'UI source not found. tried -> /nope' }) } }
    const factory2 = new AsyncFunction(
      'React', 'console', 'styles', 'host', 'harness', 'window', 'document',
      'localStorage', 'Blob', 'URL', 'setTimeout', 'ResizeObserver', 'requestAnimationFrame',
      'return (async () => {\n' + src + '\n})()',
    )
    const p2 = await factory2(React, console, styles, host2, harnessTrap, win, doc, ls, function () {}, win.URL, function () {}, function () {}, win.requestAnimationFrame)
    check('a missing UI source still returns a plugin', !!(p2 && typeof p2.apply === 'function'))
    p2.apply(ctx2)
    check('a missing UI source still registers the panel', typeof registered2.main === 'function')
    const t2 = registered2.main ? registered2.main() : null
    const text2 = t2 ? JSON.stringify(t2) : ''
    check('the degraded panel names the failure', text2.indexOf('UI source not found') >= 0)
    check('the degraded panel is not blank', text2.length > 200)
  }

  // the host handler must exist and must be able to find the file
  check('host exposes canvas-source', hostSrc.indexOf("harness.handle('canvas-source'") >= 0)
  check('host source is readable at the first candidate path', fs.existsSync('/tmp/acx/v21.client.js'))
  check('the loader never touches host-only harness', src.indexOf('harness.') < 0)

  let bad = 0
  for (let i = 0; i < checks.length; i++) {
    if (checks[i][1] !== true) bad += 1
    console.log((checks[i][1] ? 'PASS ' : 'FAIL ') + checks[i][0])
  }
  console.log(bad === 0 ? 'ALL PASS (' + checks.length + ')' : 'FAILURES ' + bad)
  process.exit(bad === 0 ? 0 : 1)
})()
