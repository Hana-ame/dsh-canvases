const fs = require('fs')

// Client: ask for a deeper, larger listing.
{
  const p = '/tmp/acx/u.client.js'
  let c = fs.readFileSync(p, 'utf8')
  const from = "const r = await hostCall('canvas-list-files', { path: root, maxDepth: 3, limit: 200 }, 15000)"
  const to = "const r = await hostCall('canvas-list-files', { path: root, maxDepth: 8, limit: 4000 }, 20000)"
  const n = c.split(from).length - 1
  if (n !== 1) throw new Error('client list call: ' + n)
  c = c.replace(from, to)
  const noteFrom = "\\u4ec5\\u663e\\u793a\\u524d 200 \\u9879"
  if (c.split(noteFrom).length - 1 === 1) c = c.replace(noteFrom, "\\u4ec5\\u663e\\u793a\\u524d 4000 \\u9879")
  fs.writeFileSync(p, c)
  console.log('client listing widened')
}

// Host: raise the caps so the caller decides, not an arbitrary small ceiling.
{
  const p = '/tmp/acx/u.host.js'
  let h = fs.readFileSync(p, 'utf8')
  const from = "const maxDepth = typeof args.maxDepth === 'number' && args.maxDepth >= 0 ? Math.min(args.maxDepth, 4) : 2\n      const limit = typeof args.limit === 'number' && args.limit > 0 ? Math.min(args.limit, 600) : 200"
  const to = "const maxDepth = typeof args.maxDepth === 'number' && args.maxDepth >= 0 ? Math.min(args.maxDepth, 12) : 2\n      const limit = typeof args.limit === 'number' && args.limit > 0 ? Math.min(args.limit, 5000) : 200"
  const n = h.split(from).length - 1
  if (n !== 1) throw new Error('host caps: ' + n)
  h = h.replace(from, to)
  fs.writeFileSync(p, h)
  console.log('host caps raised')
}
