const fs = require('fs')
const p = '/tmp/acx/u.client.js'
let c = fs.readFileSync(p, 'utf8')

function rep(from, to, label) {
  const n = c.split(from).length - 1
  if (n !== 1) throw new Error(label + ': expected 1 but found ' + n)
  c = c.replace(from, to)
  console.log('ok:', label)
}

// Replace the whole broken file-pointer block with a correct one: the pressed path
// is always tracked (so a click can select), but movement only applies in file mode.
const BAD = [
  "      function onFilePointerDown(e, f) {",
  "        if (e.button !== 0) return",
  "        e.preventDefault()",
  "        e.stopPropagation()",
  "        // Only file mode drags a file node.",
  "        const canDrag = store.get().mode === 'file'",
  "        const p = point(e)",
  "        const pos = filePosOf(f)",
  "        fileDragRef.current = canDrag",
  "          ? { path: f.path, dx: p.x - pos.x, dy: p.y - pos.y, moved: false, x0: p.x, y0: p.y }",
  "          : null",
  "        if (canDrag) setDraggingFile(f.path)",
  "        try { e.currentTarget.setPointerCapture(e.pointerId) } catch (err) {}",
  "      }",
  "      function onFilePointerMove(e) {",
  "        const d = fileDragRef.current",
  "        if (!d) return",
  "        e.preventDefault()",
  "        const p = point(e)",
  "        if (!d.moved && Math.abs(p.x - d.x0) <= 3 && Math.abs(p.y - d.y0) <= 3) return",
  "        d.moved = true",
  "        manual[d.path] = { x: p.x - d.dx, y: p.y - d.dy }",
  "        store.set({})",
  "      }",
  "      function onFilePointerUp(e) {",
  "        const d = fileDragRef.current",
  "        fileDragRef.current = null",
  "        try { e.currentTarget.releasePointerCapture(e.pointerId) } catch (err) {}",
  "        if (d === null) { toggleFile(f_pathOf(e)); return }",
  "        setDraggingFile(null)",
  "        if (d.moved) return",
  "        toggleFile(d.path)",
  "        if (touchMode) setInfo({ kind: 'file', path: d.path })",
  "      }",
  "      function f_pathOf() { return null }",
].join('\n')

const GOOD = [
  "      function onFilePointerDown(e, f) {",
  "        if (e.button !== 0) return",
  "        e.preventDefault()",
  "        e.stopPropagation()",
  "        const canDrag = store.get().mode === 'file'",
  "        const p = point(e)",
  "        const pos = filePosOf(f)",
  "        // The path is tracked even when dragging is disabled, so a plain click",
  "        // can still select the file.",
  "        fileDragRef.current = {",
  "          path: f.path,",
  "          dx: p.x - pos.x,",
  "          dy: p.y - pos.y,",
  "          moved: false,",
  "          x0: p.x,",
  "          y0: p.y,",
  "          canDrag: canDrag,",
  "        }",
  "        if (canDrag) setDraggingFile(f.path)",
  "        try { e.currentTarget.setPointerCapture(e.pointerId) } catch (err) {}",
  "      }",
  "      function onFilePointerMove(e) {",
  "        const d = fileDragRef.current",
  "        if (!d || !d.canDrag) return",
  "        e.preventDefault()",
  "        const p = point(e)",
  "        if (!d.moved && Math.abs(p.x - d.x0) <= 3 && Math.abs(p.y - d.y0) <= 3) return",
  "        d.moved = true",
  "        manual[d.path] = { x: p.x - d.dx, y: p.y - d.dy }",
  "        store.set({})",
  "      }",
  "      function onFilePointerUp(e) {",
  "        const d = fileDragRef.current",
  "        if (!d) return",
  "        fileDragRef.current = null",
  "        setDraggingFile(null)",
  "        try { e.currentTarget.releasePointerCapture(e.pointerId) } catch (err) {}",
  "        if (d.moved) return",
  "        toggleFile(d.path)",
  "        if (touchMode) setInfo({ kind: 'file', path: d.path })",
  "      }",
].join('\n')

rep(BAD, GOOD, 'fix file pointer block')
fs.writeFileSync(p, c)
console.log('written')
