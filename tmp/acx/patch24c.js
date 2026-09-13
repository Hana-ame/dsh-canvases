'use strict'
// patch24c: zoom controls (in/out/fit/reset) + the perf HUD panel.
const fs = require('fs')
const C = '/tmp/acx/v21.client.js'
let c = fs.readFileSync(C, 'utf8')

function sub(from, to, label) {
  const n = c.split(from).length - 1
  if (n === 0) throw new Error('ANCHOR MISSING: ' + label)
  if (n > 1) throw new Error('ANCHOR NOT UNIQUE (' + n + '): ' + label)
  c = c.replace(from, to)
}

// ---- perf panel visibility state ----
sub(
  "      const wsb4 = React.useState(null)",
  "      const wsb4 = React.useState(null)\n      const pf1 = React.useState(false)\n      const showPerf = pf1[0]\n      const setShowPerf = pf1[1]",
  'perf state',
)

// ---- zoom helpers + fit, inserted before filePosOf ----
sub(
  "      function filePosOf(f) {",
  `      // ---- ZOOM -------------------------------------------------------------
      // Valid range 0.3x .. 2.5x. zoomTo keeps the given screen point (anchor) fixed
      // while the scale changes, which is what makes wheel zoom feel anchored to the
      // cursor instead of drifting.
      function clampZoom(z) {
        if (!(z > 0)) return 1
        if (z < 0.3) return 0.3
        if (z > 2.5) return 2.5
        return Math.round(z * 100) / 100
      }
      function zoomTo(nz, ax, ay) {
        const z0 = viewRef.current.z
        const nzc = clampZoom(nz)
        if (nzc === z0) return
        const px = viewRef.current.x
        const py = viewRef.current.y
        const nx = ax - (ax - px) * (nzc / z0)
        const ny = ay - (ay - py) * (nzc / z0)
        viewRef.current.z = nzc
        viewRef.current.x = nx
        viewRef.current.y = ny
        setZoom(nzc)
        setPan({ x: nx, y: ny })
      }
      function zoomStep(factor) {
        const el = canvasRef.current
        const w = el && el.clientWidth ? el.clientWidth : 800
        const h = el && el.clientHeight ? el.clientHeight : 600
        zoomTo(viewRef.current.z * factor, w / 2, h / 2)
      }
      // Fit every node into view, with padding. This is the "看全" control.
      function fitToContent() {
        const el = canvasRef.current
        const w = el && el.clientWidth ? el.clientWidth : 800
        const h = el && el.clientHeight ? el.clientHeight : 600
        let minX = Infinity
        let minY = Infinity
        let maxX = -Infinity
        let maxY = -Infinity
        function see(x, y, ww, hh) {
          if (x < minX) minX = x
          if (y < minY) minY = y
          if (x + ww > maxX) maxX = x + ww
          if (y + hh > maxY) maxY = y + hh
        }
        for (let i = 0; i < st.agents.length; i++) {
          const a = st.agents[i]
          see(a.x, a.y, AGENT_SIZE, AGENT_SIZE + 14)
        }
        for (let i = 0; i < st.files.length; i++) {
          const f = st.files[i]
          const p = filePosOf(f)
          see(p.x, p.y, FILE_W, nodeH(f))
        }
        if (minX === Infinity) { setPan({ x: 36, y: 30 }); setZoom(1); return }
        const pad = 40
        const cw = Math.max(1, maxX - minX)
        const ch = Math.max(1, maxY - minY)
        const nz = clampZoom(Math.min((w - pad * 2) / cw, (h - pad * 2) / ch))
        viewRef.current.z = nz
        viewRef.current.x = pad - minX * nz
        viewRef.current.y = pad - minY * nz
        setZoom(nz)
        setPan({ x: viewRef.current.x, y: viewRef.current.y })
      }
      function filePosOf(f) {`,
  'zoom helpers',
)

// ---- wheel: zoom anchored at cursor; keep old behaviour when not zooming ----
sub(
  `        const z0 = zoom
        let nz = Math.round(z0 * step * 100) / 100
        if (nz < 0.3) nz = 0.3
        if (nz > 2) nz = 2
        if (nz === z0) return
        const rect = el.getBoundingClientRect()`,
  `        const z0 = viewRef.current.z
        let nz = Math.round(z0 * step * 100) / 100
        if (nz < 0.3) nz = 0.3
        if (nz > 2.5) nz = 2.5
        if (nz === z0) return
        const rect = el.getBoundingClientRect()`,
  'wheel zoom range',
)

// ---- toolbar: replace the three zoom buttons with a full zoom group + perf toggle ----
sub(
  `        h('button', { className: 'acx-btn', onClick: function () { setZoom(function (z) { return z <= 0.5 ? 0.5 : Math.round((z - 0.25) * 100) / 100 }) } }, '-'),
        h('button', { className: 'acx-btn', onClick: function () { setZoom(1) } }, Math.round(zoom * 100) + '%'),
        h('button', { className: 'acx-btn', onClick: function () { setZoom(function (z) { return z >= 1.5 ? 1.5 : Math.round((z + 0.25) * 100) / 100 }) } }, '+'),`,
  `        h('button', { className: 'acx-btn', title: '缩小', onClick: function () { zoomStep(0.8) } }, '\\u2212'),
        h('button', { className: 'acx-btn', title: '当前缩放（点击回到 100%）', onClick: function () { zoomTo(1, (canvasRef.current && canvasRef.current.clientWidth ? canvasRef.current.clientWidth : 800) / 2, (canvasRef.current && canvasRef.current.clientHeight ? canvasRef.current.clientHeight : 600) / 2) } }, Math.round(zoom * 100) + '%'),
        h('button', { className: 'acx-btn', title: '放大', onClick: function () { zoomStep(1.25) } }, '+'),
        h('button', { className: 'acx-btn', title: '显示全部节点', onClick: fitToContent }, '\\u9002\\u5e94'),
        h('button', {
          className: showPerf ? 'acx-btn acx-primary' : 'acx-btn',
          title: '性能监测：每帧耗时 / FPS / Host 往返 / 由拖动触发的重渲染',
          onClick: function () {
            const next = !showPerf
            if (next) { PERF.drawMax = 0; PERF.hostMs = 0; PERF.hostCalls = 0; PERF.hostTotalMs = 0; PERF.moves = 0; PERF.moveRenders = 0 }
            setShowPerf(next)
          },
        }, showPerf ? '\\u6027\\u80fd \\u5f00' : '\\u6027\\u80fd'),`,
  'zoom toolbar',
)

// ---- perf HUD panel element, next to the legend ----
sub(
  "      const legend = h('div', { className: 'acx-legend' },",
  `      const perfPanel = !showPerf ? null : h('div', { className: 'acx-perf' },
        h('div', { className: 'acx-perf-h' }, '\\u6027\\u80fd\\u76d1\\u6d4b'),
        h('div', null, '\\u5e27\\u7ed8\\u5236: ' + String(PERF.drawMs) + ' ms  (\\u5cf0\\u503c ' + String(PERF.drawMax) + ' ms)'),
        h('div', null, 'FPS: ' + (PERF.fps > 0 ? String(PERF.fps) : '\\u2014') + '  \\u00b7  \\u672c\\u5e27\\u8282\\u70b9: ' + String(PERF.drawn) + ' / ' + String(st.files.length)),
        h('div', null, '\\u62d6\\u52a8\\u4e8b\\u4ef6: ' + String(PERF.moves) + '  \\u00b7  \\u89e6\\u53d1\\u91cd\\u6e32\\u67d3: ' + String(PERF.moveRenders) + ' (\\u76ee\\u6807 0)'),
        h('div', null, 'Host \\u6700\\u6162: ' + String(Math.round(PERF.hostMs)) + ' ms' + (PERF.hostMethod ? ' (' + PERF.hostMethod + ')' : '') + '  \\u00b7  ' + String(PERF.hostCalls) + ' \\u6b21/\\u7d2f\\u8ba1 ' + String(Math.round(PERF.hostTotalMs)) + ' ms'),
        h('div', { className: 'acx-perf-n' }, '\\u62d6\\u52a8/\\u7f29\\u653e\\u4e0d\\u5e94\\u8be5\\u89e6\\u53d1 React \\u91cd\\u6e32\\u67d3\\uff1b\\u82e5\\u89e6\\u53d1\\u5219\\u5361\\u5728\\u91cd\\u6e32\\u67d3\\u800c\\u975e canvas\\u3002'),
      )
      const legend = h('div', { className: 'acx-legend' },`,
  'perf panel',
)

// render it
sub(
  "        legend,\n        st.dock ? h(ChatDock, { touch: touchMode }) : null,",
  "        legend,\n        perfPanel,\n        st.dock ? h(ChatDock, { touch: touchMode }) : null,",
  'perf panel mount',
)

// ---- CSS for the perf panel ----
sub(
  "  '.acx-touch .acx-hover{display:none}',",
  `  '.acx-perf{position:absolute;right:10px;bottom:10px;z-index:12;min-width:236px;border:1px solid var(--dsw-alias-border-l3,rgba(127,127,127,.35));border-radius:10px;padding:8px 10px;font-size:10.5px;line-height:1.6;font-family:var(--dsw-font-mono,ui-monospace,Menlo,monospace);background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-layer-2,rgba(20,20,24,.9)));color:var(--dsw-alias-label-secondary,inherit);pointer-events:none;white-space:nowrap}',
  '.acx-perf-h{font-weight:600;color:var(--dsw-alias-label-primary,inherit);margin-bottom:2px}',
  '.acx-perf-n{margin-top:3px;opacity:.75;white-space:normal;max-width:250px}',
  '.acx-touch .acx-hover{display:none}',`,
  'perf css',
)

fs.writeFileSync(C, c)
console.log('patch24c ok:', c.length, 'bytes')
