# DSH Session Canvas

A **dynamic Cordis plugin** that adds a *Session Canvas* screen to the DeepSeek Harness Web GUI: a graph where **nodes are sessions and edges are real DSH lineage**.

> Status: experimental. A dynamic Cordis package lives inside a running DSH process; it is not a persistent install. This repository is the durable copy of its source.

## What it is

| Capability | How it works |
| --- | --- |
| **A new screen** | Registers `sidebar.panellist` (a sidebar icon labelled 会话拓扑) plus a `main` panel with key `session-canvas`. Both registrations together form a new main panel. |
| **Nodes are sessions** | `sessionQuery.listSessions()` provides one durable header per session: id, `parentSession`, `origin`, `cwd`, `createdAt`, live/persisted. Subagent-origin rows the native sidebar hides are drawn here. |
| **Edges are real lineage** | A parent→child edge is drawn from `header.parentSession` only. Fork edges are solid, `origin: 'subagent'` edges are dashed. Nothing is invented, and because lineage is durable the graph rebuilds itself after a DSH restart with no bookkeeping of our own. |
| **A tidy tree, not a force soup** | Layered left-to-right layout: depth sets the column, sibling leaves are stacked without overlap, parents centre on their children. |
| **Persistent multi-turn command** | Select a node, read its transcript, and send into it: `queue` (a later turn) or `steer` (nearest step). Every message is appended to that session's durable log through `sessionController.prompt`, so the conversation survives restarts and stays in sync with the native sidebar. |
| **Stop one turn, keep the inbox** | `sessionController.cancel` cancels the live turn of the selected session and retains its pending inbox work. |
| **Grow the topology** | *Fork* derives a child session from the selected one — the way ordinary lineage actually gets created. |
| **Multi-select broadcast** | Select several sessions and send one message to all of them; per-target success/failure is reported. |
| **Subagent nodes are read-only** | They are drawn for topology and transcript, but addressing them needs the subagent control channel (`ctx.subagents`), which this package deliberately does not use yet. The dock says so instead of pretending. |
| **Layout persists** | Positions, viewport, selection and filters go to `localStorage` under `dsh-session-canvas:v1`. |
| **It polls politely** | The header list is cached on the Host for 8 s; the client's scan backs off 2.5 s → 15 s while the topology is unchanged, and an unchanged transcript does not trigger a re-render. |

## Layout

```
src/
  host.js    Host half   — the sc-* JSON RPC surface over DSH services
  client.js  Client half — the React panel, canvas renderer and interactions
scripts/
  check.mjs    Pre-flight: parse, load, banned constructs, RPC reconciliation
  selftest.mjs Behavioural gate: host handlers against fake services, plus the
               layout builder driven with synthetic session sets
  install.mjs  Runs the gate, fingerprints both halves, emits the define payload
```

Both `src/*.js` files are **plain function bodies**: `host.js` is `code.host` and `client.js` is `code.client` for the `cordis_define` tool. Plain JavaScript only — no TypeScript, JSX, imports or bundler.

## Host RPC surface

| Method | Purpose |
| --- | --- |
| `sc-info` | Service availability and limits, for the status line. |
| `sc-sessions` | Durable session headers with `parentId`, `origin`, `cwd`, `live`, `persisted`. Cached 8 s; `{ force: true }` bypasses. |
| `sc-titles` | Durable titles for up to 150 ids (separate from the list because it is not cached). |
| `sc-read` | Transcript projection of one session: last 240 messages from the trailing 4000 events, with `omitted` and `windowed`. |
| `sc-prompt` | Admit one prompt into one ordinary session (`queue` \| `steer`), minting the `requestId`. |
| `sc-cancel` | Cancel the session's current turn, keeping its inbox. |
| `sc-fork` | Fork a session. |

Every handler returns an owned JSON value, treats an absent service as `{ ok: false, error }`, and never throws. The Host half never touches the filesystem.

## Gates

```
npm run gate        # check + selftest
npm run check       # syntax, load, banned constructs, RPC reconciliation
npm run selftest    # behavioural: host handlers + layout builder
```

`check.mjs` blanks strings, regex and comments before scanning so a rule cannot trip on prose, then loads each half with the same fixed names the Cordis evaluator provides (`harness`, `console` / `React`, `styles`, `host`) and asserts it returns a Plugin with `apply`. `selftest.mjs` calls every captured host handler against fabricated services shaped like the real ones, and drives `buildGraph` with synthetic session sets — lineage, filters, layout invariants, manual overrides and edge derivation. Both are code execution, not grep.

## Installing into a running DSH

A dynamic package cannot be installed from the shell. The shell can prepare it:

```
node scripts/install.mjs            # short prompt; the agent reads ./src
node scripts/install.mjs --prompt   # self-contained prompt (~70 KB)
node scripts/install.mjs --json     # machine-readable payload
```

`install.mjs` refuses to emit anything while `check.mjs` fails, and prints the sha256 of each half so the package in the process can be matched against these files later.

Then, in a session whose agent preset provides the Cordis tools:

1. `cordis_define` with the emitted argument (`plugin.kind: "new"`, `idPrefix: "canvas"`).
2. `cordis_run(pluginId, packageId, mode: "run")`.
3. **Approve the client half.** A client package returns `awaiting-approval`; one check mark authorises the current package, two authorise future versions of the same plugin.
4. **Refresh the browser page.** A client half only loads at page load.
5. A 会话拓扑 entry appears in the left sidebar.

Bump `STAMP` in `src/client.js` on every iteration; it is printed to the console on load and shown in the tool card, so the running build can be identified at a glance.

## Version compatibility

This package reaches into DSH and Cordis through surfaces that are **not versioned in this repository**. The unversioned touchpoints are:

| Touchpoint | Half | Fails as |
| --- | --- | --- |
| `sessionQuery.listSessions()` records; `header.id` / `.parentSession` / `.origin` / `.cwd` / `.createdAt`; `rec.live` / `.persisted` | host | no nodes, wrong lineage |
| `sessionQuery.readTitleSnapshots(ids)` → `{ sessionId, status, value.title.title }` | host | titles vanish, nodes fall back to short ids |
| `sessionQuery.readSession(id)` → `{ session, events }`; event shapes `user/message.content`, `assistant/message.message.content`, `tool/call.name` | host | transcript empty |
| `sessionController.prompt({ requestId, sessionId, mode, content }, signal)` | host | send fails; the client falls back to its `sessions` binding |
| `sessionController.cancel({ sessionId })` | host | Stop fails (subagent-owned sessions are refused by design) |
| `sessionController.fork({ sessionId })` | host | Fork fails |
| Cordis slots `main` (key `session-canvas`), `sidebar.panellist` (id `session-canvas`), `tool.view.cordis` (key `self`) | client | the screen never appears |
| Cordis `timer` service via `ctx.get('timer').timeout(ms)`, and `styles.insert(css)` returned to `ctx.effect` | client | polling stops |
| Client globals `React`, `styles`, `host`, and `ctx.get('sessions').open(id)` | client | panel fails to load / "在侧栏打开" fails |

If `npm run gate` still passes but the canvas misbehaves after a DSH upgrade, suspect one of these rows rather than the package: the gates verify the package's own hygiene and internal behaviour, not the runtime's shape.

## Known limits

- **Subagent command is not wired.** Subagent-origin nodes show topology and transcript only.
- **Streaming is step-granular.** The transcript poll projects durable surface events, so an in-flight assistant step appears when it settles, not token by token. The native chat view streams live.
- **Topology is header-derived.** A session whose `parentSession` is missing from the corpus is drawn as a root (its recorded parent is still shown in the dock).
- **The canvas list is capped** at 600 sessions; the status line says when it truncated.
- **State placement.** Layout lives in `localStorage`; topology lives in DSH and is re-derived. Nothing else is stored.
- **Experimental.** The dynamic-plugin surface makes no stability promise while it incubates.

## License

MIT
