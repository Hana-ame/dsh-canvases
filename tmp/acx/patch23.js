'use strict'
// patch23: kill the four real per-frame / per-poll costs behind "还是太卡了".
//  1. backdrop-filter:blur(12px) on .acx-bar sits over a canvas that repaints every frame:
//     the compositor re-filters the backdrop each frame. Remove it, keep a readable fallback bg.
//  2. paletteRef.current = readPalette() ran inside the draw effect, whose deps include
//     hoverAgentId/hoverFile/draggingId -> 8x getComputedStyle per hover change (style recalc).
//     Gate it to at most once per second.
//  3. clipText() binary-searches measureText per visible node per frame, uncached.
//  4. session poll called sessionQuery.listSessions() (measured 390ms of host CPU) every 5s,
//     freezing the shared host event loop. Poll slower + cache the listing host-side.
//     Also back off the file walk when it is slow, and stop rewriting dataset.panning per move.
const fs = require('fs')

const CLIENT = '/tmp/acx/v21.client.js'
const HOST = '/tmp/acx/v21.host.js'
let c = fs.readFileSync(CLIENT, 'utf8')
let h = fs.readFileSync(HOST, 'utf8')

function sub(text, from, to, label) {
  const n = text.split(from).length - 1
  if (n === 0) throw new Error('ANCHOR MISSING: ' + label)
  if (n > 1) throw new Error('ANCHOR NOT UNIQUE (' + n + '): ' + label)
  return text.replace(from, to)
}

// ---- 1. drop the per-frame backdrop blur, add an opaque fallback so text stays readable ----
c = sub(
  c,
  'background:var(--dsw-alias-button-floating-fill,var(--dsw-alias-bg-overlay,transparent));backdrop-filter:blur(12px);flex-wrap:wrap',
  'background:var(--dsw-alias-button-floating-fill,var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-layer-2,rgba(20,20,24,.86))));flex-wrap:wrap',
  'css backdrop-filter',
)

// ---- 2. palette stamp ----
c = sub(c, 'let lastDrawCount = 0', 'let lastDrawCount = 0\nlet paletteStamp = 0', 'palette stamp decl')

c = sub(
  c,
  '        paletteRef.current = readPalette()\n        drawRef.current = drawGraph\n        drawGraph()',
  '        if (paletteRef.current === null || Date.now() - paletteStamp > 1000) {\n' +
  '          paletteRef.current = readPalette()\n' +
  '          paletteStamp = Date.now()\n' +
  '        }\n' +
  '        drawRef.current = drawGraph\n' +
  '        drawGraph()',
  'palette gating',
)

// ---- 3. memoise text clipping (font is part of the key: it changes between calls) ----
c = sub(
  c,
  '      function clipText(g, text, maxW) {\n' +
  '        const s = String(text === undefined || text === null ? \'\' : text)\n' +
  '        if (s.length === 0) return \'\'\n' +
  '        if (g.measureText(s).width <= maxW) return s',
  '      const clipCache = {}\n' +
  '      let clipCacheSize = 0\n' +
  '      function clipText(g, text, maxW) {\n' +
  '        const s = String(text === undefined || text === null ? \'\' : text)\n' +
  '        if (s.length === 0) return \'\'\n' +
  '        const ck = String(g.font) + \'|\' + String(Math.round(maxW)) + \'|\' + s\n' +
  '        const hit = clipCache[ck]\n' +
  '        if (hit !== undefined) return hit\n' +
  '        const out = clipTextUncached(g, s, maxW)\n' +
  '        if (clipCacheSize > 4000) { for (const k in clipCache) delete clipCache[k]; clipCacheSize = 0 }\n' +
  '        clipCache[ck] = out\n' +
  '        clipCacheSize += 1\n' +
  '        return out\n' +
  '      }\n' +
  '      function clipTextUncached(g, s, maxW) {\n' +
  '        if (g.measureText(s).width <= maxW) return s',
  'clipText memo',
)

// ---- 4a. slower session poll ----
c = sub(
  c,
  '            dispose = timer.timeout(function () {\n' +
  '              Promise.resolve(refresh()).then(schedule, schedule)\n' +
  '            }, 5000)',
  '            dispose = timer.timeout(function () {\n' +
  '              Promise.resolve(refresh()).then(schedule, schedule)\n' +
  '            }, 15000)',
  'session poll cadence',
)

// ---- 4b. adaptive file-scan backoff ----
c = sub(c, '    const FILE_SCAN_MS = 6000', '    let fileScanMs = 6000', 'scan const')
c = sub(c, '(now - lastFileScan) > FILE_SCAN_MS', '(now - lastFileScan) > fileScanMs', 'scan use')
c = sub(
  c,
  '      if (ws && dueScan) {\n        const r = await hostCall(\'canvas-list-files\', { path: ws, maxDepth: 8, limit: 4000 }, 20000)',
  '      if (ws && dueScan) {\n        const scanStart = Date.now()\n        const r = await hostCall(\'canvas-list-files\', { path: ws, maxDepth: 8, limit: 4000 }, 20000)',
  'scan timing start',
)
c = sub(
  c,
  '          lastFileScan = now\n          lastScanRoot = ws',
  '          lastFileScan = now\n          lastScanRoot = ws\n          fileScanMs = Date.now() - scanStart > 400 ? 30000 : 6000',
  'scan backoff',
)

// ---- 4c. do not rewrite the same dataset attribute every pan frame ----
c = sub(
  c,
  "          try { e.currentTarget.dataset.panning = '1' } catch (err) {}",
  "          try { if (e.currentTarget.dataset.panning !== '1') e.currentTarget.dataset.panning = '1' } catch (err) {}",
  'pan dataset write',
)

// ---- host: cache the expensive listing so a burst of polls cannot freeze the loop ----
h = sub(
  h,
  '    let reqSeq = 0',
  '    let reqSeq = 0\n    let sessCache = null\n    let sessCacheAt = 0\n    const SESS_CACHE_MS = 10000',
  'host cache decl',
)
h = sub(
  h,
  '        const records = await sessionQuery.listSessions()\n        const list = Array.isArray(records) ? records.slice(0, 300) : []',
  '        const nowTs = Date.now()\n' +
  '        let records\n' +
  '        if (sessCache !== null && (nowTs - sessCacheAt) < SESS_CACHE_MS) {\n' +
  '          records = sessCache\n' +
  '        } else {\n' +
  '          records = await sessionQuery.listSessions()\n' +
  '          sessCache = records\n' +
  '          sessCacheAt = nowTs\n' +
  '        }\n' +
  '        const list = Array.isArray(records) ? records.slice(0, 300) : []',
  'host session listing cache',
)

fs.writeFileSync(CLIENT, c)
fs.writeFileSync(HOST, h)
console.log('patched', CLIENT, c.length, 'bytes /', HOST, h.length, 'bytes')
