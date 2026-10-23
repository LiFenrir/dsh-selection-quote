import { describe, expect, it } from 'vitest'
import type { UserTextTransformContext } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { en, zh } from '../src/client/locales'
import { quoteBlockOf, quoteMessages, quoteTextRule } from '../src/client/user-text-rule'

// The quote rule reads no facts, so the context only has to answer the call shape.
const noFacts: UserTextTransformContext = { read: () => undefined }

function match(text: string, from = 0) {
  return quoteTextRule.match(text, from, noFacts)
}

/** Body of the first quote block at or after `from`; the rule's union return is narrowed by id. */
function bodyOf(text: string, from = 0): string | undefined {
  const node = match(text, from)
  return node?.id === 'selection-quote' ? node.data.body : undefined
}

describe('quoteTextRule', () => {
  it('has order 5', () => {
    expect(quoteTextRule.order).toBe(5)
  })

  it('matches a zh block and returns its true offsets and body', () => {
    const text = '前言\n【引用】助手回复 · 第 12 轮\n正文第一行\n正文第二行\n【/引用】\n后文'
    const start = text.indexOf('【引用】')
    const end = text.indexOf('【/引用】') + '【/引用】'.length
    expect(match(text)).toEqual({
      id: 'selection-quote',
      start,
      end,
      data: { body: '正文第一行\n正文第二行' },
    })
  })

  it('matches a block that starts after the blank-line padding', () => {
    const text = '\n\n【引用】助手回复 · 第 12 轮\n正文\n【/引用】\n\n'
    const start = text.indexOf('【引用】')
    const end = text.indexOf('【/引用】') + '【/引用】'.length
    expect(match(text)).toEqual({ id: 'selection-quote', start, end, data: { body: '正文' } })
  })

  it('matches an en block', () => {
    const text = '[Quote]Assistant reply · turn 3\nhello\n[/Quote]'
    expect(match(text)).toEqual({ id: 'selection-quote', start: 0, end: text.length, data: { body: 'hello' } })
  })

  it('returns the first of two blocks, then the second from its end offset', () => {
    const first = '【引用】用户消息 · 第 1 轮\nA\n【/引用】'
    const second = '[Quote]Assistant reply · turn 2\nB\n[/Quote]'
    const text = `${first}\n\n${second}`
    const one = match(text)
    expect(bodyOf(text)).toBe('A')
    const two = match(text, one?.end ?? 0)
    expect(two).toMatchObject({ id: 'selection-quote', start: text.indexOf('[Quote]'), data: { body: 'B' } })
  })

  it('picks the earlier block when zh and en delimiters both appear', () => {
    const text = '[Quote]Assistant reply\nEN\n[/Quote] 【引用】用户消息\nZH\n【/引用】'
    expect(bodyOf(text)).toBe('EN')
  })

  it('honors the from offset and skips earlier blocks', () => {
    const text = '【引用】来源\nA\n【/引用】'
    expect(match(text, 1)).toBeUndefined()
  })

  it('does not match an unclosed block', () => {
    expect(match('【引用】来源\n正文')).toBeUndefined()
  })

  it('does not match an empty body', () => {
    expect(match('【引用】来源\n\n【/引用】')).toBeUndefined()
  })

  it('does not match a whitespace-only body', () => {
    expect(match('【引用】来源\n   \n【/引用】')).toBeUndefined()
  })

  it('skips an empty block and matches a later non-empty one', () => {
    const text = '【引用】来源\n\n【/引用】 [Quote]Assistant reply\nok\n[/Quote]'
    expect(bodyOf(text)).toBe('ok')
  })

  it('accepts CRLF line breaks and returns the body without them', () => {
    expect(bodyOf('【引用】来源\r\n正文\r\n【/引用】')).toBe('正文')
  })

  it('keeps a delimiter-like escape inside the body', () => {
    const text = '【引用】用户消息 · 第 3 轮\n我在文档里写过 〔引用〕 这种样板\n【/引用】'
    expect(bodyOf(text)).toBe('我在文档里写过 〔引用〕 这种样板')
  })

  it('does not match text that only contains the escape form', () => {
    expect(match('〔引用〕来源\n正文\n〔/引用〕')).toBeUndefined()
  })

  it('rejects a source line longer than 120 characters', () => {
    expect(match(`【引用】${'x'.repeat(121)}\n正文\n【/引用】`)).toBeUndefined()
  })

  it('accepts a source line of exactly 120 characters', () => {
    expect(bodyOf(`【引用】${'x'.repeat(120)}\n正文\n【/引用】`)).toBe('正文')
  })
})

describe('quote role', () => {
  /** Role of the first quote block in `text`, or undefined when the block has none. */
  function roleOf(text: string) {
    const node = match(text)
    return node?.id === 'selection-quote' ? node.data.role : undefined
  }

  it('reads the assistant role from a zh source line', () => {
    expect(roleOf('【引用】助手回复\n正文\n【/引用】')).toBe('assistant')
  })

  it('reads the user role from an en source line', () => {
    expect(roleOf('[Quote]User message\nhi\n[/Quote]')).toBe('user')
  })

  it('reads the user role from a zh source line', () => {
    expect(roleOf('【引用】用户消息\n正文\n【/引用】')).toBe('user')
  })

  it('leaves the role unset for a legacy source line that carries a turn number', () => {
    expect(roleOf('【引用】助手回复 · 第 12 轮\n正文\n【/引用】')).toBeUndefined()
  })

  it('leaves the role unset for an unknown source line', () => {
    expect(roleOf('【引用】别的来源\n正文\n【/引用】')).toBeUndefined()
  })
})

describe('quoteBlockOf', () => {
  it('parses the body and role of the first block in a padded chip text', () => {
    expect(quoteBlockOf('\n\n【引用】用户消息\nA\n【/引用】\n\n')).toEqual({ body: 'A', role: 'user' })
  })

  it('returns undefined when the text has no quote block', () => {
    expect(quoteBlockOf('plain text')).toBeUndefined()
  })
})

describe('quoteMessages', () => {
  it('returns the zh and en delimiter pairs', () => {
    expect(quoteMessages()).toEqual([
      { open: zh['format.open'], close: zh['format.close'] },
      { open: en['format.open'], close: en['format.close'] },
    ])
  })
})
