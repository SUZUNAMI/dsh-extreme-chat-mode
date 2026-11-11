# dsh-extreme-chat-mode

An **Extreme Chat** agent preset for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness): every request the model sees contains only **your messages**, **its own replies**, and the two web tools `web_search` / `web_fetch`. No system prompt, no AGENTS.md, no skill catalog, no runtime context, no other tools.

Pick **Extreme Chat** when creating a session.

## What is kept and what is removed

| Context source | Standard preset | Extreme Chat |
| --- | --- | --- |
| System prompt | persona + harness identity + tool guidance sections | **empty** (renders to an empty string) |
| AGENTS.md | loaded | not loaded |
| Skill catalog | yes | no |
| Runtime context (cwd / sandbox / approval / source root / Web URL) | yes | no |
| Tools | ~50 tools registered by the profile's plugins | **only `web_search` / `web_fetch`** plus the agent-scoped `sentinel_*` tools (registered by `dsh-sentinel`; see below) |
| Context compaction | yes | yes |

## How it is switched off

| Row | Effect | Mechanism |
| --- | --- | --- |
| `persona` | whole system prompt | `prefix: ''` + `complete: true`: the complete section becomes the only system section, replacing harness identity, tool guidance, `HARNESS_SOURCE`, `WEB_SURFACE`; its text is empty |
| `persona` (same row) | optional runtime contexts | `includeRuntimeContext: false` → `systemPrompt.suppressRuntimeContext()` |
| `extreme-chat-no-tools` | every inherited tool | `ctx.tools.restrict({ allow: ['web_search', 'web_fetch'] })` |
| `extreme-chat-no-tools` | `working-directory:current` | the only `required: true` runtime context on DSH 0.2.2; it survives suppression, so the plugin registers an empty same-named entry in the same scope to shadow it |
| (not mounted) | AGENTS.md / skill catalog | `agent-instructions`, `tool-skill` and `skill-filesystem` are not mounted |

## Prerequisite: the host must own the web tools

The allow-list only validates names registered on the **host** layer. DSH `0.2.2`'s `dsh-web-app` bundle disables the host `tool-web` row, so the profile patch must re-enable it:

```yaml
# ~/.dsh/profiles/desktop/cordis.patch.yml
- id: tool-web
  name: '@deepseek-ai/dsh-tool-web'
  disabled: false
  config:
    fetch: true
    searchTimeoutMs: 60000
```

Without this row, mounting `tool-web` inside the preset still makes the tools appear, but they land in the **preset scope** — `restrict` treats them as own-layer tools, so `allow: ['web_search','web_fetch']` fails with `unknown global tool`, and `allow: []` hides them again (the "only sentinel tools are left" symptom).

## Install

Requires DeepSeek Harness 0.2.1 or newer.

```text
plugin_manager install_bundle target github:TongenShen/dsh-extreme-chat-mode
```

Fully quit and restart DSH afterwards — the preset composition is read at startup.

## Notes

- Preset `id` is `extreme-chat`, display name `Extreme Chat`, `order: 0` (first in the roster).
- Only new sessions are affected; running sessions keep the preset they started with.
- `sentinel_watch` / `sentinel_list` / `sentinel_cancel` are registered by `dsh-sentinel` in each agent's own scope, so `restrict` cannot filter them. Removing them requires uninstalling `dsh-sentinel` or patching it to skip registration for this preset.
- Web tools still depend on `DEEPSEEK_API_KEY` / the DeepSeek account token.
- The plugin writes `report.json` on every mount (`state` = `whitelist` / `failed` / `none`) so tool filtering can be diagnosed.
- Context compaction stays enabled; remove the `compaction` group to have strictly nothing added, at the cost of failing once the context window is exhausted.

## Uninstall

```text
plugin_manager remove_bundle target dsh-extreme-chat-mode
```

Then restart DSH.

## License

MIT
