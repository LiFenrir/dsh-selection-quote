import { describe, expect, it } from 'vitest'
import {
  DEFAULT_QUOTE_LIMIT,
  composeSourceLabel,
  formatQuoteBody,
  normalize,
  quoteBlock,
  truncate,
  type QuoteMessages,
} from '../src/client/format'

const messages: QuoteMessages = {
  open: '【引用】',
  close: '【/引用】',
  escapeOpen: '〔引用〕',
  escapeClose: '〔/引用〕',
  user: '用户消息',
  assistant: '助手回复',
  truncated: '…（引用已截断，原文 {count} 字符）',
}

describe('normalize', () => {
  it('trims the ends and keeps single newlines', () => {
    expect(normalize('  第一行\n第二行  \n')).toBe('第一行\n第二行')
  })

  it('collapses three or more newlines into one blank line', () => {
    expect(normalize('a\n\n\n\nb')).toBe('a\n\nb')
  })

  it('leaves a single blank line alone', () => {
    expect(normalize('a\n\nb')).toBe('a\n\nb')
  })
})

describe('truncate', () => {
  it('returns text that fits unchanged', () => {
    expect(truncate('abc', 3, messages)).toBe('abc')
  })

  it('keeps exactly the limit and reports the full length', () => {
    const text = 'x'.repeat(DEFAULT_QUOTE_LIMIT + 1)
    expect(truncate(text, DEFAULT_QUOTE_LIMIT, messages)).toBe(
      `${'x'.repeat(DEFAULT_QUOTE_LIMIT)}\n…（引用已截断，原文 ${DEFAULT_QUOTE_LIMIT + 1} 字符）`,
    )
  })

  it('counts code points, so an emoji is never split', () => {
    const text = `${'😀'.repeat(4000)}x`
    const out = truncate(text, 4000, messages)
    expect(out.startsWith('😀'.repeat(4000) + '\n')).toBe(true)
    expect(out).toContain('原文 4001 字符')
  })

  it('accepts text whose code-point count equals the limit', () => {
    const text = '😀'.repeat(4000)
    expect(truncate(text, 4000, messages)).toBe(text)
  })
})

describe('formatQuoteBody', () => {
  it('keeps a multi-line selection as plain lines', () => {
    const body = formatQuoteBody({
      raw: '先给结论：把 O(n²) 改成 O(n log n)\n代价是多一倍内存。',
      flowKind: 'assistant-step',
      messages,
    })
    expect(body).toBe('先给结论：把 O(n²) 改成 O(n log n)\n代价是多一倍内存。')
  })

  it('returns an empty body for whitespace-only input', () => {
    expect(formatQuoteBody({ raw: ' \n ', flowKind: 'user', messages })).toBe('')
  })

  it('escapes open and close delimiters found in the text', () => {
    const body = formatQuoteBody({
      raw: '我在文档里写过 【引用】 和 【/引用】 这种样板',
      flowKind: 'user',
      messages,
    })
    expect(body).toBe('我在文档里写过 〔引用〕 和 〔/引用〕 这种样板')
  })

  it('fences code with its language', () => {
    const body = formatQuoteBody({
      raw: 'ignored',
      flowKind: 'assistant-step',
      code: { lang: 'ts', text: 'for (const row of rows) {\n  total += row.amount\n}' },
      messages,
    })
    expect(body).toBe('```ts\nfor (const row of rows) {\n  total += row.amount\n}\n```')
  })

  it('uses a bare fence when the language is unknown', () => {
    const body = formatQuoteBody({ raw: '', flowKind: 'assistant-step', code: { text: 'x = 1' }, messages })
    expect(body).toBe('```\nx = 1\n```')
  })

  it('lengthens the fence when the code already contains triple backticks', () => {
    const body = formatQuoteBody({
      raw: '',
      flowKind: 'assistant-step',
      code: { lang: 'md', text: 'before\n```\ninside\n```' },
      messages,
    })
    expect(body.startsWith('````md\n')).toBe(true)
    expect(body.endsWith('\n````')).toBe(true)
  })

  it('appends the truncation note for long code', () => {
    const body = formatQuoteBody({
      raw: '',
      flowKind: 'assistant-step',
      code: { text: 'a'.repeat(5) },
      messages,
      limit: 4,
    })
    expect(body).toBe('```\naaaa\n…（引用已截断，原文 5 字符）\n```')
  })
})

describe('composeSourceLabel', () => {
  it('labels an assistant reply', () => {
    expect(composeSourceLabel('assistant-step', messages)).toBe('助手回复')
  })

  it('labels a user or steering message as a user message', () => {
    expect(composeSourceLabel('user', messages)).toBe('用户消息')
    expect(composeSourceLabel('steering', messages)).toBe('用户消息')
  })
})

describe('quoteBlock', () => {
  it('wraps the body with the delimiters and source line', () => {
    expect(quoteBlock('正文', '助手回复 · 第 12 轮', messages)).toBe(
      '【引用】助手回复 · 第 12 轮\n正文\n【/引用】',
    )
  })
})
