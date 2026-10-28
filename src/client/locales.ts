/**
 * Runtime dictionary for the selection-quote namespace. Only the missing-source
 * notice is left after the feature was reduced to click-to-source.
 */
export const zh = {
  'notice.sourceMissing': '原消息已不在当前会话中',
} as const

export const en = {
  'notice.sourceMissing': 'The quoted message is no longer loaded',
} satisfies Record<keyof typeof zh, string>

export type QuoteKey = keyof typeof zh
