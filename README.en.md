# dsh-session-tags

Tag sessions in [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) and browse them as a colored, collapsible tag tree in the left sidebar. Tags are shared across workspaces and nest with `/`.

## Install

```bash
dsh plugin --profile web add github:shuiyujinlan/dsh-session-tags
```

Restart `dsh web` and hard-reload the browser (Ctrl+Shift+R). Uninstall:

```bash
dsh plugin --profile web remove dsh-session-tags
```

Data stays at `$DSH_HOME/session-tags/tags.json` (or `~/.dsh/session-tags/tags.json`); uninstalling does not delete it.

## Usage

1. Open a conversation and click the 🏷 button beside its title, or hover a sidebar row and click the 🏷 action.
2. Tick existing tags or type a new one. `work/cfgf/fig2` creates both parent tags.
3. The tree appears under "Tag groups"; click a group to collapse/expand, click a member to open it.
4. Hovering a group header reveals color (palette), rename and delete. Deleting a parent deletes its subtree.

Tags take colors from a 10-color palette; tagged rows show colored dots at the start, and their hover card lists the full tags.

## Features

- Always-visible "Tag groups" section above the workspace list; collapse it to one row.
- Sub-tags with `/`, indentation, per-level collapse, parent counts include children.
- Default palette plus custom color picker.
- Colored row markers and hover chips.
- Cascading rename/delete for parent tags.
- Collapse state in localStorage; tags/colors/assignments on the Host.

## Compatibility

- Verified on DSH `0.2.1-rc.2` (Web profile, Windows 11, Node 24).
- The inline section anchors on host classes `bhn1Oq_root` / `bhn1Oq_listArea`; a large sidebar refactor may hide the section (no crash; buttons still work).
- The row-leading slot is used by host status dots while those show (host behavior).

## Data and API

- File: `$DSH_HOME/session-tags/tags.json` — `{ version: 2, tags: [{ name, color }], assignments: { [sessionId]: [tagPath] } }`.
- Route: `GET/POST /session-tags/api`; `op` is `setSessionTags` / `renameTag` / `deleteTag` / `setTagColor`.
- Auth: every request goes through `ctx.connection.admit(req)`, owner only; 503 without the connection service.
- No session-log reads/writes, no `workspace.json` changes, no network calls, no subprocesses.

## Development

```bash
node --check index.js && node --check client.js
```

Host: `index.js` (restart or disable→enable). Client: `client.js` (hard reload).

## License

MIT, see [LICENSE](LICENSE).
