/**
 * Runtime dictionary for the selection-quote namespace. `zh` defines the key
 * set; `en` is checked against it with `satisfies`, so a missing or extra key
 * fails to compile.
 *
 * Format delimiters live here, not in format.ts, so the English dictionary can
 * swap them without touching the serializer.
 */
export const zh = {
  'action.quote': '引用',
  'action.close': '关闭',
  'toolbar.label': '划词引用',
  'hint.crossNode': '请在同一段消息内选择',
  'notice.busy': '输入框正在提交，稍后再引用',
  'notice.insertFailed': '引用插入失败，请重新选择',
  'notice.sourceMissing': '原消息已不在当前会话中',
  'source.user': '用户消息',
  'source.assistant': '助手回复',
  'card.label': '引用',
  'card.reveal': '回到原处',
  'chip.label': '引用 · {role} · {preview}',
  'format.open': '【引用】',
  'format.close': '【/引用】',
  'format.escapeOpen': '〔引用〕',
  'format.escapeClose': '〔/引用〕',
  'format.truncated': '…（引用已截断，原文 {count} 字符）',
} as const

export const en = {
  'action.quote': 'Quote',
  'action.close': 'Close',
  'toolbar.label': 'Selection quote',
  'hint.crossNode': 'Select within a single message',
  'notice.busy': 'The composer is submitting; quote again shortly',
  'notice.insertFailed': 'Could not insert the quote; select again',
  'notice.sourceMissing': 'The quoted message is no longer loaded',
  'source.user': 'User message',
  'source.assistant': 'Assistant reply',
  'card.label': 'Quote',
  'card.reveal': 'Jump to source',
  'chip.label': 'Quote · {role} · {preview}',
  'format.open': '[Quote]',
  'format.close': '[/Quote]',
  'format.escapeOpen': '(Quote)',
  'format.escapeClose': '(/Quote)',
  'format.truncated': '…(quote truncated, original {count} characters)',
} satisfies Record<keyof typeof zh, string>

export type QuoteKey = keyof typeof zh
