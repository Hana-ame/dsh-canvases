# DSH Canvases

Every Canvas-family **dynamic Cordis Plugin** working copy found on this
machine, plus the DSH plugin material that was sitting in `/tmp`, collected into
one repository.

## Working copies (repository root)

| Directory | What it is | Taken from |
| --- | --- | --- |
| `dsh-session-canvas/` | **Session Canvas** — sessions as nodes, real DSH lineage (`header.parentSession`) as edges, with multi-turn prompting of ordinary sessions from a transcript dock. | local `master`, `bacd2b0` |
| `dsh-agent-canvas/` | **Agent Canvas** — a file-as-node agent graph screen, with install/check/selftest tooling and CI. | `main`, `cf27c76` |
| `dsh-agent-canvas-work/` | An earlier clone of Agent Canvas. | `main`, `7596ecf` |

## `tmp/` — plugin material recovered from `/tmp`

| Directory | What it is |
| --- | --- |
| `tmp/acx/` | The **acx** plugin working directory: both halves as loose files (`acx.host.js` / `acx.client.js`), the v18–v22 iteration line and its `.preNN` snapshots, patch scripts, gate scripts, a `bench/` harness, and `修改意见.md`. |
| `tmp/dsh-canvas/` | A clone of Agent Canvas at `7596ecf`. The directory name says `dsh-canvas`, but its remote is `dsh-agent-canvas`. |
| `tmp/dsh-agent-canvas/` | The same clone, plus an untracked `修改意见.md`. |
| `tmp/graphc-2/` | The canvas gate/bench harness (`gate19_21.js` … `gate23.js`, `bench/`). Tooling, not a plugin. |
| `tmp/npm-packages/agentteam/` | Extracted `deepseek-ai-dsh-experimental-agent-team{,-profile}` and `deepseek-ai-dsh-experimental-tool-agent-team` packages. |
| `tmp/npm-packages/dshprobe/` | Extracted `deepseek-ai-dsh-client-connection` package (`package/`, `p2/`). |
| `tmp/npm-packages/pristine/` | Extracted pristine copies of shipped packages: `dsh-llm`, `dsh-llm-deepseek`, `dsh-llm-pi-ai`, `dsh-api-session-controller`, `dsh-agent-default-model`. |
| `tmp/npm-packages/rc2/` | Extracted `dsh-llm-deepseek`, `dsh-llm-pi-ai`. |

The `tmp/npm-packages/*` trees are **first-party DSH packages extracted from
npm**, kept here as reference material. They were not authored in this
repository; delete them wholesale if you only want the plugin sources.

### What was deliberately not copied

* `.git/` — each copy keeps its history in its own repository.
* `node_modules/` and `*.tgz` — redundant with the extracted package trees.
* **`bench/cookie.txt`** (present under both `tmp/acx/` and the original
  `/tmp/graphc-2/`) — a **live, HMAC-signed DSH Web GUI auth cookie** minted for
  authority `127.0.0.1:3080` from the secret in `~/.dsh/.credentials.yaml`, valid
  for 7 days. It is a credential and is intentionally **not** published. The
  script that mints it (`bench/mintcookie.js`) *is* included: it contains no
  secret, only the construction.

## Note on history

Every directory is a **snapshot**; the sources did not share a history, so this
repository does not carry their individual commit graphs. Each upstream
repository still holds its own history.

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

本仓库收集了这台机器上 Canvas 系列**动态 Cordis 插件**的所有工作副本，以及原先散落在 `/tmp` 里的 DSH 插件材料。

- 根目录三个：`dsh-session-canvas/`（会话拓扑）、`dsh-agent-canvas/`（文件即节点的 agent 图）、`dsh-agent-canvas-work/`（Agent Canvas 旧克隆）。
- `tmp/`：`acx/`（acx 插件的松散两半 + v18–v22 迭代 + patch/gate/bench）、`dsh-canvas/` 与 `dsh-agent-canvas/`（Agent Canvas 的两个 `/tmp` 克隆）、`graphc-2/`（canvas 的 gate/bench 工装）、`npm-packages/`（从 npm 解出的第一方 DSH 包，非本仓库所写，可整目录删掉）。
- **故意没有复制**：`.git/`、`node_modules/`、`*.tgz`，以及 `bench/cookie.txt`——那是一个**有效的 DSH GUI 登录凭据**（`127.0.0.1:3080`，7 天有效），不能进公开仓库。铸造它的 `mintcookie.js` 已收录（本身不含密钥）。

所有目录都是**快照**，没有合并各自的提交历史。
