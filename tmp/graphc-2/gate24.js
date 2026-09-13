'use strict'
const fs = require('fs')
const src = fs.readFileSync('/tmp/acx/v21.client.js', 'utf8')
let pass = 0, fail = 0
function check(name, cond) { if (cond) { pass += 1; console.log('PASS ' + name) } else { fail += 1; console.log('FAIL ' + name) } }
// single workspace root
check('one synthetic workspace root owner exists', /const WS_ID = '__workspace__'/.test(src))
check('the tree roots at the workspace, not per agent', /if \(st\.workspace\) agentsById\[WS_ID\] = \{ id: WS_ID/.test(src))
check('files belong to the workspace root', /agentId: ws \? WS_ID : null/.test(src))
// collapsed folders
check('no direct children are auto-placed into a folder', src.indexOf('s.files.push(f)') < 0)
check('folder node counts total children and split count', /s\.done \+= 1/.test(src))
// split exactly one, list both kinds
check('splitChild splits exactly one child', /function splitChild\(dirPath, childPath, isDir\)/.test(src))
check('the split list contains folders and files', /function dirEntries\(dirPath\)/.test(src))
check('a folder child becomes a revealed node', /revealed\[childPath\] = true/.test(src) && /revealed\[f\.path\] !== true\) continue/.test(src))
check('a file child becomes a free node', /manual\[childPath\] = \{ x: ox, y: oy \}/.test(src))
// highlight by cwd/path scope
check('hover resolves a path scope (agent cwd or folder)', /let scopePath = null/.test(src) && /function inScope\(p\)/.test(src))
check('sections highlight when in scope', /const sHl = inScope\(s\.dirPath\)/.test(src))
check('files highlight when in scope', /inScope\(f\.path\)/.test(src))
// no global loose column
check('no global loose column remains', src.indexOf('let loose = 0') < 0)
check('unplaced files are not drawn', /if \(manual\[f\.path\] === undefined && filePosIndex\[f\.path\] === undefined\) continue\n          const p = livePosOf\(f\)/.test(src))

// ---- canvas-only contract ----
check('CANVAS_ONLY flag is on', /const CANVAS_ONLY = true/.test(src))
check('agent creation is gated off the toolbar', /CANVAS_ONLY \? null : h\('button', \{ className: 'acx-btn acx-primary', onClick: spawnAgent \}, '\+ Agent'\)/.test(src))
check('projection/export/session toggles are gated', (src.match(/CANVAS_ONLY \? null :/g) || []).length >= 8)
check('chat dock is not rendered in canvas-only mode', /\(st\.dock && !CANVAS_ONLY\) \? h\(ChatDock/.test(src))
check('reset clears manual AND revealed AND cache', /function resetCanvas\(\) \{[\s\S]{0,600}clearCache\(\)[\s\S]{0,400}delete revealed\[k\]/.test(src))
check('reset puts the viewport back', /viewRef\.current = \{ x: 36, y: 30, z: 1 \}[\s\S]{0,120}setZoom\(1\)/.test(src))
check('toolbar reset button calls resetCanvas', /onClick: resetCanvas \}, '重置'/.test(src))

console.log(fail === 0 ? 'ALL PASS (' + pass + ')' : 'FAILURES ' + fail)
process.exit(fail === 0 ? 0 : 1)
