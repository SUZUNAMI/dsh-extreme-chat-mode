import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * 极限 Chat 模式：把宿主注入的工具收成 web_search / web_fetch 两个，并去掉
 * 宿主要求的运行时上下文条目。
 *
 * 为什么这次能成：联网工具由**宿主层**提供（profile patch 里把 web-app 关掉的
 * `tool-web` 行重新打开），落在 global 层；对预设的作用域视图来说它们属于
 * 「继承工具」，所以 `restrict({ allow: ['web_search','web_fetch'] })` 的名单
 * 校验能通过。此前预设自己挂 tool-web 时，工具在预设作用域里是 own，
 * 名单校验永远失败——那才是反复只剩 3 个 sentinel 的根因。
 *
 * 宿主工具在启动时就注册完毕，正常情况下第一次 restrict 就成功；为防慢启动，
 * 失败时监听 `tools/change` 并每 300 ms 重试，最多等 60 s。等不到就**不限制**
 * （宁可多出工具，也不要因为空集把联网工具一起挡掉），并把原因写进 report.json。
 *
 * 运行时上下文：0.2.2 里 `includeRuntimeContext: false` 只压掉 required !== true 的
 * 条目，`working-directory:current` 是唯一 required 项，于是在同一 agent 作用域
 * 注册同名空条目遮蔽它（ScopedLayers.merge 让最近作用域胜出）。
 */

export const name = 'extreme-chat-no-tools'

export const inject = ['tools', 'systemPrompt']

/** 唯一放行的继承工具。 */
const WEB_TOOLS = ['web_search', 'web_fetch']

/** 0.2.2 里唯一标了 required: true 的 runtime context。 */
const REQUIRED_CONTEXT_NAME = 'working-directory:current'

/** 等宿主注册联网工具的重试参数。 */
const RETRY_INTERVAL_MS = 300
const DEADLINE_MS = 60000

/** 自检结果文件（覆盖写，方便事后核对）。 */
const REPORT_FILE = fileURLToPath(new URL('./report.json', import.meta.url))

/**
 * 把限制状态写进报告文件；写失败不影响预设。
 * @param state - `whitelist` / `failed` / `none`。
 * @param detail - 附加信息。
 */
function report(state, detail = {}) {
  if (process.env.DSH_VERIFY_PRESET === '1') return
  try {
    writeFileSync(REPORT_FILE, `${JSON.stringify({ at: new Date().toISOString(), state, ...detail })}\n`)
  } catch {
    // 报告只是排查用，写不进去也不影响预设。
  }
}

/**
 * 取 runtime context 的排序值；宿主不再提供该常量时回落到它与相邻策略之间的位置。
 * @param ctx - agent 作用域上下文。
 * @returns 有限数字。
 */
function workingDirectoryOrder(ctx) {
  try {
    const order = ctx.systemPrompt.getContextOrder('WORKING_DIRECTORY')
    return Number.isFinite(order) ? order : 100
  } catch {
    return 100
  }
}

/**
 * 把继承工具收成联网工具白名单；名字晚注册时短暂重试，等不到就保持不限制。
 * @param ctx - agent 作用域上下文。
 * @returns 解除限制并停止重试的清理函数。
 */
function restrictInheritedTools(ctx) {
  /** @type {(() => void) | undefined} */
  let dispose
  let installed = false
  /** @type {ReturnType<typeof setInterval> | undefined} */
  let timer
  let stopWatching = () => {}
  const startedAt = Date.now()
  let lastError

  const stop = () => {
    stopWatching()
    if (timer !== undefined) clearInterval(timer)
    timer = undefined
  }

  const install = () => {
    if (installed) return true
    try {
      dispose = ctx.tools.restrict({ allow: WEB_TOOLS })
      installed = true
      stop()
      report('whitelist', { afterMs: Date.now() - startedAt })
      return true
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
      return false
    }
  }

  if (!install()) {
    const tick = () => {
      if (install()) return
      if (Date.now() - startedAt >= DEADLINE_MS) {
        stop()
        report('failed', { afterMs: Date.now() - startedAt, error: lastError })
        console.warn(
          '[extreme-chat-mode] could not restrict inherited tools; leaving the tool set untouched:',
          lastError,
        )
      }
    }
    try {
      stopWatching = ctx.on('tools/change', tick)
    } catch {
      stopWatching = () => {}
    }
    timer = setInterval(tick, RETRY_INTERVAL_MS)
    timer.unref?.()
  }

  return () => {
    stop()
    dispose?.()
  }
}

/**
 * 把继承工具收成联网工具，并遮蔽必需的 working-directory 上下文。
 *
 * 注意：0.2.2 的 `system-prompt/assemble` waterfall 拿不到最终的 `tools`（工具表在
 * waterfall 之后才并进返回值），所以「按 agent 注册的 own 层工具」（例如
 * dsh-sentinel 的 sentinel_*）无法在这一层过滤——那需要移除或修改对应插件。
 * @param ctx - agent 作用域上下文。
 */
export function apply(ctx) {
  ctx.effect(
    () => restrictInheritedTools(ctx),
    'extreme-chat-preset.restrict-inherited-tools',
  )

  ctx.effect(
    () => {
      try {
        return ctx.systemPrompt.context({
          name: REQUIRED_CONTEXT_NAME,
          order: workingDirectoryOrder(ctx),
          required: false,
          interpolate: false,
          text: '',
        })
      } catch (error) {
        // 这条 required 条目在本宿主上已不存在时，遮蔽本身没有意义。
        console.warn(
          '[extreme-chat-mode] skipped working-directory shadow:',
          error instanceof Error ? error.message : String(error),
        )
        return () => {}
      }
    },
    'extreme-chat-preset.shadow-required-context',
  )
}
