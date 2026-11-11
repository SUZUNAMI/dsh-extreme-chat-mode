# dsh-extreme-chat-mode

An **Extreme Chat** agent preset for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness): every model request carries exactly two things — **your input** and **the model's own output**. No system prompt, no AGENTS.md, no skill catalog, no runtime context, no tools.

Pick **Extreme Chat** when starting a new session.

## How it differs from Chat mode

Chat mode (`dsh-chat-mode`) keeps a persona, AGENTS.md, the skill catalog, runtime context, and web search. Extreme mode zeroes all of it:

| Source | Chat | Extreme Chat |
| --- | --- | --- |
| System prompt | short chat persona | **empty** |
| Harness identity sentence | yes | no |
| AGENTS.md | loaded | not loaded |
| Skill catalog | yes | no |
| runtime context (sandbox / approval) | yes | no |
| Tools | `web_search` / `web_fetch` | **none** |
| Context compaction | yes | yes |

## How each gate closes

| Row | Removes | Mechanism |
| --- | --- | --- |
| `persona` | the whole system prompt | `prefix: ''` with `complete: true`. A complete section becomes the *only* system section, discarding harness identity, tool guidance, `HARNESS_SOURCE`, `WEB_SURFACE`, and everything else; the prefix is empty, so that single section is empty too |
| `persona` (same row) | the runtime context snapshot | `includeRuntimeContext: false` calls `systemPrompt.suppressRuntimeContext()`, dropping every optional slot |
| `extreme-chat-no-tools` | every inherited tool | `ctx.tools.restrict({ allow: [] })` — the set of allowed inherited tools is empty |
| `extreme-chat-no-tools` | `working-directory:current` | the *only* runtime context marked `required: true`, which `suppressRuntimeContext` cannot drop; shadowed by a same-named empty entry in the same scope (`ScopedLayers.merge` lets the nearest scope win, `dsh-scope/lib/index.js:179`) |
| (not mounted) | AGENTS.md | without `agent-instructions` there is no baseline instruction injection |
| (not mounted) | skill catalog | without `tool-skill` / `skill-filesystem` there is no `<available_skills>` reminder |

Tool masking uses `allow: []` rather than `deny: [...]`: whatever global tools the Host registers now or later stay invisible, with no list to maintain. Chat mode's deny list has to be updated whenever the Host adds a global tool.

## Install

Requires DeepSeek Harness 0.2.1-rc.1 or later.

```text
plugin_manager install_bundle target github:TongenShen/dsh-extreme-chat-mode
```

Restart DSH afterwards, then pick **Extreme Chat** when starting a new session.

## Notes

- Preset `id` is `extreme-chat`, display name `Extreme Chat`, `order: 0` (first in the roster, alongside Chat).
- Applies to **new sessions** only; running sessions keep the preset they started with.
- With no system prompt at all the model receives no role, language, or formatting instruction. If replies drift in style, compare against Chat mode to confirm this is the cause.
- Compaction stays on: old turns are summarized when the window fills, and `/compact` works. That adds one summary message, but ordinary turns are unaffected. To inject nothing ever, drop the `compaction` group from `cordis.patch.yml` — the cost is that requests fail once the window overflows.

## Uninstall

```text
plugin_manager remove_bundle target dsh-extreme-chat-mode
```

Then restart DSH.

## License

MIT
