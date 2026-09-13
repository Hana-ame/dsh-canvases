# DSH Agent Canvas

A **dynamic Cordis Plugin** that adds an *Agent Canvas* screen to the DeepSeek Harness Web GUI: a graph where **agents are nodes' authors and real files are the nodes**.

> Status: experimental. The canvas is a runtime extension of a live DSH process, not a persistent install.

## What it does

| Capability | How it works |
| --- | --- |
| **A new screen** | Registers `sidebar.panellist` (a sidebar icon) plus a `main` screen with key `agent-canvas`. Those two registrations together form a new main panel. |
| **Humans only create agents** | There is no "create node" dialog. You give an agent a mission; that is the only input. |
| **Files become nodes** | The Host half walks each agent's working directory with the `fs` service. Anything that appeared **after the canvas started watching** is flagged `new` (green border, solid edge, a count badge on the agent). |
| **Select files → spawn a new agent** | Click files to select them (multi-select), then *Create Agent from N selected files*. The mission is pre-filled with the selected absolute paths and the working directory defaults to their common parent. |
| **Hover an agent = its context scope** | Hovering shows the mission, working directory, file-node count, how many of those this session created, the file list, and the projected DSH session id. |
| **Chat is a projection of the sidebar** | Selecting an agent renders that session's transcript with live streaming. Sending goes through the same `sessions.binding(id).session.prompt(...)` path the web UI uses, so the sidebar and the canvas stay in sync. |
| **Multi-select broadcast** | Select several agents and send one prompt to all of them; each receives its own working directory and mission. Per-agent success/failure is reported. |
| **Projection / fork** | *Project session* lists existing sessions and binds one as an agent. *Fork* derives a child session via `sessionController.fork`. *Open in sidebar* switches to the native conversation view. |
| **Mobile** | Narrow screens use a top canvas with bottom sheets instead of a fixed side drawer; tap opens the context card (touch has no hover); a *multi-select* toggle replaces Ctrl/Cmd; zoom controls and 50%–150% scaling. |

## Layout

```
src/
  host.js    Host half   — JSON RPC handlers (harness.handle) over DSH services
  client.js  Client half — the React canvas UI, slots, and stylesheet
```

Both files are **plain function bodies**: `src/host.js` is the content of `code.host` and
`src/client.js` is the content of `code.client` for the `cordis_define` tool. They are plain
JavaScript — no TypeScript, JSX, or bundler — and both are syntax-checked with `new Function`.

## Host RPC surface

| Method | Purpose |
| --- | --- |
| `canvas-sessions` | Visible sessions with `cwd`, `live`, `persisted`, and durable titles. |
| `canvas-presets` | Agent presets available to new sessions. |
| `canvas-list-files` | Real filesystem projection of a working directory (depth 2, capped). |
| `canvas-create-session` | Create/adopt a session; optionally with an explicit `cwd` and preset. |
| `canvas-fork-session` | Fork a session. |
| `canvas-read-session` | Fallback transcript reader when no live client binding exists. |
| `canvas-send-prompt` | Fallback prompt delivery (the client binding is preferred). |

Services are read with `ctx.get(name)` and an explicit `undefined` check, because a dynamic Host
half must tolerate a service being absent rather than assume it.

## Design notes / known limits

- **State is per-process.** Nodes, agents, and positions live only in the running DSH process.
  A DSH restart clears the canvas. Dynamic plugins are not written to disk by DSH, which is why
  this repository exists: it is the durable copy.
- **The canvas never affects real sessions destructively.** Removing an agent only removes it from
  the canvas; it does not delete the session.
- **Baseline semantics.** "New" means *appeared after this canvas began watching that directory*.
  It is a heuristic for "the agent created it", not a guarantee.
- **Every Host call carries a deadline.** A Host half that never answers surfaces as a reported
  error instead of an interface stuck on "creating"; a create that times out re-lists sessions and
  adopts a matching one, since the session may exist even when the reply was lost.
- Files are laid out by index; drag positions are remembered per path in memory.

## Using it

The plugin is a **dynamic** Cordis package. It is defined in the running DSH process with the
`cordis_define` tool, then activated with `cordis_run`:

1. `cordis_define` with `code.host` = `src/host.js`, `code.client` = `src/client.js`.
2. `cordis_run` the returned package (client packages require user approval).
3. **Refresh the browser page** — a client half is loaded at page load, so an already-open page
   keeps running the previous version until it is reloaded.

## License

MIT — see [LICENSE](LICENSE).
