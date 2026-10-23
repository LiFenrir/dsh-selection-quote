// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FLASH_DURATION_MS, findQuoteSource, matchKey, revealElement } from '../src/client/reveal'

/** A chat message node, marked the way `ChatNodeSeat` marks it. */
function node(key: string, flowKind: string, text: string): HTMLElement {
  const el = document.createElement('div')
  el.setAttribute('data-chat-node-key', key)
  el.setAttribute('data-chat-flow-kind', flowKind)
  el.textContent = text
  return el
}

function mount(...nodes: HTMLElement[]): void {
  document.body.replaceChildren(...nodes)
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('matchKey', () => {
  it('skips fence lines and blank lines and takes the first text line', () => {
    expect(matchKey('\n```ts\n  \n先给结论  \n第二行')).toBe('先给结论')
  })

  it('collapses whitespace runs in the key', () => {
    expect(matchKey('  先给   结论 ')).toBe('先给 结论')
  })

  it('cuts the key to 60 code points', () => {
    expect(Array.from(matchKey('甲'.repeat(70)))).toHaveLength(60)
  })

  it('is empty when the body has no text line', () => {
    expect(matchKey('```\n```')).toBe('')
  })
})

describe('findQuoteSource', () => {
  it('finds the node by its exact key before trying text', () => {
    const a = node('a', 'assistant-step', 'foo')
    mount(a, node('b', 'assistant-step', 'bar'))
    expect(findQuoteSource(document, { body: '不存在', nodeKey: 'a' })).toBe(a)
  })

  it('falls back to text when the key is not loaded', () => {
    const b = node('b', 'assistant-step', 'bar')
    mount(node('a', 'assistant-step', 'foo'), b)
    expect(findQuoteSource(document, { body: 'bar', nodeKey: 'zzz' })).toBe(b)
  })

  it('matches the body key inside the message text', () => {
    const a = node('a', 'assistant-step', '先给结论：把 O(n²) 改成 O(n log n)')
    mount(node('u', 'user', '别的话'), a)
    expect(findQuoteSource(document, { body: '先给结论：把 O(n²) 改成 O(n log n)\n第二行' })).toBe(a)
  })

  it('filters text matches by role', () => {
    const user = node('u', 'user', '同一句')
    const assistant = node('a', 'assistant-step', '同一句')
    mount(user, assistant)
    expect(findQuoteSource(document, { body: '同一句', role: 'assistant' })).toBe(assistant)
    expect(findQuoteSource(document, { body: '同一句', role: 'user' })).toBe(user)
  })

  it('counts a steering message as a user message', () => {
    const steering = node('s', 'steering', '补充说明')
    mount(node('a', 'assistant-step', '补充说明'), steering)
    expect(findQuoteSource(document, { body: '补充说明', role: 'user' })).toBe(steering)
  })

  it('prefers the exact flow kind over the role', () => {
    const steering = node('s', 'steering', '补充说明')
    mount(node('u', 'user', '补充说明'), steering)
    expect(findQuoteSource(document, { body: '补充说明', role: 'user', flowKind: 'steering' })).toBe(steering)
  })

  it('returns the nearest matching node before `before`', () => {
    const old = node('old', 'assistant-step', '重复句')
    const recent = node('recent', 'assistant-step', '重复句')
    const card = node('card', 'user', '引用 重复句')
    mount(old, recent, card)
    expect(findQuoteSource(document, { body: '重复句', role: 'assistant' }, card)).toBe(recent)
  })

  it('ignores matches that come after `before`', () => {
    const early = node('early', 'user', '重复句')
    const late = node('late', 'assistant-step', '重复句')
    mount(early, late)
    expect(findQuoteSource(document, { body: '重复句' }, early)).toBeNull()
  })

  it('returns the last match when there is no `before`', () => {
    const first = node('first', 'assistant-step', '重复句')
    const last = node('last', 'assistant-step', '重复句')
    mount(first, last)
    expect(findQuoteSource(document, { body: '重复句' })).toBe(last)
  })

  it('returns null when nothing is loaded that matches', () => {
    mount(node('a', 'assistant-step', '别的内容'))
    expect(findQuoteSource(document, { body: '不存在' })).toBeNull()
  })

  it('returns null for a body without a text line instead of matching everything', () => {
    mount(node('a', 'assistant-step', '任意内容'))
    expect(findQuoteSource(document, { body: '```\n```' })).toBeNull()
  })
})

describe('revealElement', () => {
  it('does nothing when scrollIntoView and animate are missing', () => {
    expect(() => revealElement(document.createElement('div'))).not.toThrow()
  })

  it('scrolls to the center and flashes an outline for the flash duration', () => {
    const el = document.createElement('div')
    el.scrollIntoView = vi.fn()
    el.animate = vi.fn()
    revealElement(el)
    expect(el.scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' })
    expect(el.animate).toHaveBeenCalledWith(expect.any(Array), { duration: FLASH_DURATION_MS, easing: 'ease-out' })
  })

  it('keeps the scroll when the highlight throws', () => {
    const el = document.createElement('div')
    el.scrollIntoView = vi.fn()
    el.animate = () => { throw new Error('unsupported keyframes') }
    expect(() => revealElement(el)).not.toThrow()
    expect(el.scrollIntoView).toHaveBeenCalled()
  })
})
