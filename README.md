# dsh-session-tags

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）的会话打标签，并在左侧栏用一棵彩色、可折叠的标签树浏览。标签跨工作区共享，用 `/` 分层。

## 安装

```bash
dsh plugin --profile web add github:shuiyujinlan/dsh-session-tags
```

装完重启 `dsh web`，浏览器 **Ctrl+Shift+R** 硬刷新。卸载：

```bash
dsh plugin --profile web remove dsh-session-tags
```

数据文件在 `$DSH_HOME/session-tags/tags.json`（未设置时为 `~/.dsh/session-tags/tags.json`），卸载不会删除它；需要时手动删。

## 使用

1. 打开会话，点标题旁的 🏷；或悬停左侧会话行，点行末 🏷。
2. 勾选已有标签，或在底部输入新标签。输入 `工作/CFGF/图2` 会同时创建两级父标签。
3. 左侧「标签分组」立刻出现这棵树：点组头折叠/展开，点成员打开会话。
4. 悬停组头可改颜色（调色板）、重命名、删除；删除父标签会删整棵子树。

标签颜色默认从 10 色序列分配；带标签的会话在行首显示彩色小点，悬停卡片显示完整标签。

## 特性

- 左侧常驻「标签分组」区块，整块可收成一行。
- 子标签：`/` 分层、缩进、逐级折叠，父级计数含子级。
- 颜色：默认调色板 + 自定义取色。
- 会话行首彩色标记 + 悬停彩色标签。
- 重命名父标签级联改子标签和成员路径；删除父标签级联删除。
- 折叠状态存浏览器 localStorage；标签、颜色、成员存 Host。

## 兼容性

- 验证于 DSH `0.2.1-rc.2`（Web profile，Windows 11，Node 24）。
- 侧栏区块依赖宿主 CSS 类名 `bhn1Oq_root` / `bhn1Oq_listArea`；DSH 大改侧栏后区块可能不显示（不报错，按钮仍可用）。
- 行首色点插槽在宿主展示状态点时会被占用（宿主行为）。

## 数据与接口

- 文件：`$DSH_HOME/session-tags/tags.json`，格式 `{ version: 2, tags: [{ name, color }], assignments: { [sessionId]: [tagPath] } }`。
- 路由：`GET/POST /session-tags/api`；`POST` 的 `op` 为 `setSessionTags` / `renameTag` / `deleteTag` / `setTagColor`。
- 鉴权：每个请求过 `ctx.connection.admit(req)`，仅 `owner`；连接服务缺失时 503。
- 不读写会话日志，不改 `workspace.json`，不发网络请求，无子进程。

## 开发

```bash
node --check index.js && node --check client.js
```

Host 改 `index.js`（重启或 disable→enable）；Client 改 `client.js`（硬刷新）。

## 许可

MIT，见 [LICENSE](LICENSE)。
