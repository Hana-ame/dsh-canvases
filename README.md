# DSH Canvases

Three working copies of the Canvas family of **dynamic Cordis Plugins** for the
DeepSeek Harness (DSH) Web GUI, collected into one repository.

| Directory | What it is | Git state it was taken from |
| --- | --- | --- |
| `dsh-session-canvas/` | **Session Canvas** — sessions as nodes, real DSH lineage (`header.parentSession`) as edges, with multi-turn prompting of ordinary sessions from a transcript dock. | local `master`, `bacd2b0` (no prior remote) |
| `dsh-agent-canvas/` | **Agent Canvas** — a file-as-node agent graph screen, with install/check/selftest tooling and CI. | `main`, `cf27c76` (remote: `Hana-ame/dsh-agent-canvas`) |
| `dsh-agent-canvas-work/` | An earlier clone of Agent Canvas, kept as-is. | `main`, `7596ecf` (remote: `Hana-ame/dsh-agent-canvas`) |

## Note on history

Each directory is a **snapshot** of its working copy at the commit named above;
the three did not share a history, so this repository does not carry their
individual commit graphs. Each upstream repository still holds its own history.

## How these plugins are used

A dynamic Cordis package only exists inside a **live** DSH process: it is handed
to the process with the `cordis_define` tool and activated with `cordis_run`.
It is a runtime extension, not a persistent install — restarting the process
means re-activating the package.

Both projects follow the same two-half layout:

```
src/
  host.js    Host half   — JSON RPC handlers (harness.handle) over DSH services
  client.js  Client half — the React canvas UI, slots, and stylesheet
```

Each project carries its own pre-flight tooling; run it from inside the
directory it belongs to:

```
node scripts/check.mjs      # parse, banned constructs, RPC wiring
node scripts/selftest.mjs   # behavioural test of the Host half
node scripts/install.mjs    # print the paste-ready prompt for a DSH agent
```

## 中文速览

本仓库把 Canvas 系列的三个工作副本收在一起：

- `dsh-session-canvas/` —— **会话拓扑**：会话为节点、真实 lineage 为边，可从画布的 transcript dock 给普通会话发消息。
- `dsh-agent-canvas/` —— **Agent Canvas**：以真实文件为节点的 agent 图，带 check/selftest/install 工具与 CI。
- `dsh-agent-canvas-work/` —— Agent Canvas 的旧副本，原样保留。

三个目录各自是**快照**，没有合并彼此的提交历史；各自的上游仓库仍保留完整历史。
