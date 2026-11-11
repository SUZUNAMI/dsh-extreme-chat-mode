# dsh-extreme-chat-mode

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 用的 **极限 Chat 模式** Agent 预设：模型每一次请求里只有两样东西——**你的输入**和**模型自己的输出**。系统提示词、AGENTS.md、技能目录、运行时上下文、全部工具，一个都不注入。

新建会话时选 **Extreme Chat** 即可。

## 和 Chat 模式的差别

Chat 模式（`dsh-chat-mode`）保留了人设、AGENTS.md、技能目录、运行时上下文和联网搜索。极限模式把这些全部清零：

| 上下文来源 | Chat 模式 | 极限 Chat |
| --- | --- | --- |
| 系统提示词 | 一段聊天人设 | **空** |
| Harness 身份句 | 有 | 无 |
| AGENTS.md | 载入 | 不载入 |
| 技能目录 | 有 | 无 |
| runtime context 快照（沙箱 / 审批策略） | 有 | 无 |
| 工具 | `web_search` / `web_fetch` | **零个** |
| 上下文压缩 | 有 | 有 |

## 四个闸门怎么关的

`cordis.patch.yml` 里每一行对应一个来源：

| 行 | 关掉了什么 | 机制 |
| --- | --- | --- |
| `persona` | 系统提示词全体 | `prefix: ''` + `complete: true`。`complete` 段会成为**唯一**的 system 段，把 harness identity、工具指导、`HARNESS_SOURCE`、`WEB_SURFACE` 等所有其他段一起顶掉；前缀为空，所以唯一那段也是空文本 |
| `persona`（同一行） | runtime context 快照 | `includeRuntimeContext: false` 走 `systemPrompt.suppressRuntimeContext()`，压掉全部可选槽位 |
| `extreme-chat-no-tools` | 全部继承来的工具 | `ctx.tools.restrict({ allow: [] })`——允许的继承工具集合为空 |
| `extreme-chat-no-tools` | `working-directory:current` | runtime context 里**唯一**标了 `required: true` 的一条，`suppressRuntimeContext` 压不掉它；在同一作用域注册同名空条目遮蔽（`ScopedLayers.merge` 让最近作用域胜出，`dsh-scope/lib/index.js:179`） |
| （不挂） | AGENTS.md | 不挂 `agent-instructions` 就没有 baseline 指令注入 |
| （不挂） | 技能目录 | 不挂 `tool-skill` / `skill-filesystem` 就没有 `<available_skills>` 提醒 |

工具屏蔽用 `allow: []` 而不是 `deny: [...]`：不管 Host 现在或将来注册了哪些全局工具，一律不可见，不需要维护名单。Chat 模式的 deny 名单就得随 Host 新增全局工具而更新。

## 安装

需要 DeepSeek Harness 0.2.1-rc.1 或更高版本。

```text
plugin_manager install_bundle target github:TongenShen/dsh-extreme-chat-mode
```

安装后**重启 DSH**，新建会话时在预设选择里选 **Extreme Chat**。

## 注意事项

- 预设 `id` 是 `extreme-chat`，显示名 `Extreme Chat`，`order: 0`（和 Chat 并列排在预设列表最前）。
- 只对**新建会话**生效；已经开始的会话保持原来的预设。
- 完全没有系统提示词意味着模型没有收到任何角色、语言或格式约束。若回答风格飘忽，先用 Chat 模式对比确认是不是这个原因。
- 保留上下文压缩：快满时自动把旧对话压成摘要，也可以用 `/compact`。压缩会在会话里追加一段摘要消息，但正常轮次不受影响。想彻底不注入任何额外内容，把 `compaction` 组从 `cordis.patch.yml` 里删掉——代价是超窗口后请求直接失败。

## 卸载

```text
plugin_manager remove_bundle target dsh-extreme-chat-mode
```

然后重启 DSH。

## License

MIT
