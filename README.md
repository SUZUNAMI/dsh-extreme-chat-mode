# dsh-extreme-chat-mode

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 用的 **极限 Chat 模式** Agent 预设：模型每次请求里只有**你的输入**、**模型自己的输出**，以及 `web_search` / `web_fetch` 两个联网工具的定义。系统提示词、AGENTS.md、技能目录、运行时上下文、其余工具都不注入。

新建会话时选 **Extreme Chat** 即可。

## 保留与移除

| 上下文来源 | 标准预设 | 极限 Chat |
| --- | --- | --- |
| 系统提示词 | 人设 + harness 身份句 + 各工具指导段 | **空**（渲染结果是空字符串） |
| AGENTS.md | 载入 | 不载入 |
| 技能目录 | 有 | 无 |
| runtime context（工作目录 / 沙箱 / 审批策略 / 源码路径 / Web URL） | 有 | 无 |
| 工具 | profile 插件注册的约 50 个 | **只有 `web_search` / `web_fetch`** ＋ 按 agent 注册的 `sentinel_*`（插件侧注册，预设挡不住） |
| 上下文压缩 | 有 | 有 |

## 怎么关的

| 行 | 作用 | 机制 |
| --- | --- | --- |
| `persona` | 系统提示词全体 | `prefix: ''` + `complete: true`：complete 段成为唯一 system 段，harness identity、工具指导、`HARNESS_SOURCE`、`WEB_SURFACE` 一起被顶掉，且文本为空 |
| `persona`（同一行） | runtime context 的可选条目 | `includeRuntimeContext: false` → `systemPrompt.suppressRuntimeContext()` |
| `extreme-chat-no-tools` | 其余全部继承工具 | `ctx.tools.restrict({ allow: ['web_search', 'web_fetch'] })` |
| `extreme-chat-no-tools` | `working-directory:current` | 0.2.2 里唯一 `required: true` 的 runtime context，压制只滤非必需项；在同作用域注册同名空条目遮蔽 |
| （不挂） | AGENTS.md / 技能目录 | 不挂 `agent-instructions`、`tool-skill`、`skill-filesystem` |

## 前置条件（重要）

联网工具必须由**宿主层**提供，白名单才认得这两个名字。DSH `0.2.2` 的 `dsh-web-app` 会在宿主层把全局 `tool-web` 行 disable 掉，因此需要在 `~/.dsh/profiles/desktop/cordis.patch.yml` 里把它重新启用：

```yaml
- id: tool-web
  name: '@deepseek-ai/dsh-tool-web'
  disabled: false
  config:
    fetch: true
    searchTimeoutMs: 60000
```

没有这一行时：预设里自己挂 `tool-web` 也能让联网工具出现，但它们会落在**预设作用域**（对 `restrict` 来说是 own 层），`allow: ['web_search','web_fetch']` 校验会失败（`unknown global tool`），而 `allow: []` 又会把它们一起挡掉——表现就是「只剩 sentinel 三个哨兵工具」。

## 安装

需要 DeepSeek Harness 0.2.1 或更高版本。

```text
plugin_manager install_bundle target github:TongenShen/dsh-extreme-chat-mode
```

安装后**完全退出并重启 DSH**（预设组合在启动时读取，改完文件不重启不生效），新建会话时在预设选择里选 **Extreme Chat**。

## 注意事项

- 预设 `id` 是 `extreme-chat`，显示名 `Extreme Chat`，`order: 0`（排在预设列表最前）。
- 只对**新建会话**生效；已经开始的会话保持原来的预设。
- `sentinel_watch` / `sentinel_list` / `sentinel_cancel` 由 `dsh-sentinel` 在每个 agent 的作用域里注册，`restrict` 只过滤继承工具，挡不住它们。要彻底只剩两个联网工具，需要：从 profile 移除 `dsh-sentinel`，或给它打一个「`extreme-chat` 预设跳过注册」的本地补丁。
- 联网工具能否真正可用还取决于 `DEEPSEEK_API_KEY` / 账号令牌；`web_search` 走 DeepSeek 搜索端点，`web_fetch` 走本地 HTTP 抓取。
- 插件每次挂载会写一份 `report.json`（`state` 为 `whitelist` / `failed` / `none`），用于排查限制是否生效。
- 保留上下文压缩：快满时把旧对话压成摘要，也可以用 `/compact`。想彻底不注入任何内容，把 `compaction` 组整段删掉——代价是超窗口后请求直接失败。

## 卸载

```text
plugin_manager remove_bundle target dsh-extreme-chat-mode
```

然后重启 DSH。

## License

MIT
