/**
 * 极限 Chat 模式：清掉模型能看到的全部工具与最后一条必需上下文。
 *
 * 两件事：
 *
 * 1. 工具清空 —— 用 `allow: []` 而不是 `deny: [...]`。语义是「允许的继承
 *    工具集合为空」，因此不管 Host 现在或将来注册了哪些全局工具，一律不可见，
 *    不需要维护名单。限制只作用于继承来的工具，本作用域自己注册的仍然可见；
 *    本预设不注册任何工具，所以模型拿到的工具列表就是空的。
 *
 * 2. 遮蔽 `working-directory:current` —— 这一条是 runtime context 里唯一
 *    标了 `required: true` 的，`includeRuntimeContext: false`
 *    （systemPrompt.suppressRuntimeContext）只压制可选槽位，压不掉它。
 *    这里在同一 agent 作用域注册一个同名条目：ScopedLayers.merge 让最近作用
 *    域的同名条目胜出（dsh-scope/lib/index.js:179），于是这条不再是 required，
 *    也随之被 suppression 一起丢掉。
 */
export const name = 'extreme-chat-no-tools'

export const inject = ['tools', 'systemPrompt']

/** The one runtime context marked required, therefore not suppressible by includeRuntimeContext: false. */
const REQUIRED_CONTEXT_NAME = 'working-directory:current'

export function apply(ctx) {
  ctx.effect(
    () => ctx.tools.restrict({ allow: [] }),
    'extreme-chat-preset.restrict-all-tools',
  )

  ctx.effect(
    () => ctx.systemPrompt.context({
      name: REQUIRED_CONTEXT_NAME,
      order: ctx.systemPrompt.getContextOrder('WORKING_DIRECTORY'),
      required: false,
      interpolate: false,
      text: '',
    }),
    'extreme-chat-preset.shadow-required-context',
  )
}
