// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  FLASH_DURATION_MS,
  findQuoteSource,
  HIGHLIGHT_NAME,
  matchKey,
  revealElement,
  textRangeOf,
} from '../src/client/reveal'

/** A chat message node, marked the way `ChatNodeSeat` marks it. */
function node(key: string, text: string): HTMLElement {
  const el = document.createElement('div')
  el.setAttribute('data-chat-node-key', key)
  el.textContent = text
  return el
}

/** A message node with inline markup, as the rendered transcript has it. */
function message(html: string): HTMLElement {
  const el = document.createElement('div')
  el.setAttribute('data-chat-node-key', 'a')
  el.innerHTML = html
  document.body.append(el)
  return el
}

function mount(...nodes: HTMLElement[]): void {
  document.body.replaceChildren(...nodes)
}

/** Put a global back into the state captured before a test. */
function restoreGlobal(name: string, descriptor: PropertyDescriptor | undefined): void {
  if (descriptor === undefined) {
    Reflect.deleteProperty(globalThis, name)
  } else {
    Object.defineProperty(globalThis, name, descriptor)
  }
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
  it('matches the body key inside the message text', () => {
    const a = node('a', '先给结论：把 O(n²) 改成 O(n log n)')
    mount(node('u', '别的话'), a)
    expect(findQuoteSource(document, '先给结论：把 O(n²) 改成 O(n log n)\n第二行')).toBe(a)
  })

  it('returns the nearest matching node before `before`', () => {
    const old = node('old', '重复句')
    const recent = node('recent', '重复句')
    const quote = node('quote', '引用 重复句')
    mount(old, recent, quote)
    expect(findQuoteSource(document, '重复句', quote)).toBe(recent)
  })

  it('ignores matches that come after `before`', () => {
    const early = node('early', '重复句')
    const late = node('late', '重复句')
    mount(early, late)
    expect(findQuoteSource(document, '重复句', early)).toBeNull()
  })

  it('returns the last match when there is no `before`', () => {
    const first = node('first', '重复句')
    const last = node('last', '重复句')
    mount(first, last)
    expect(findQuoteSource(document, '重复句')).toBe(last)
  })

  it('falls back to the nearest match when `before` is no longer connected', () => {
    const first = node('first', '重复句')
    const last = node('last', '重复句')
    mount(first, last)
    const detached = node('quote', '重复句')
    expect(detached.isConnected).toBe(false)
    expect(findQuoteSource(document, '重复句', detached)).toBe(last)
  })

  it('searches only the session container that holds `before`', () => {
    const other = document.createElement('div')
    other.setAttribute('data-conversation-session', 'other')
    other.append(node('other-node', '重复句'))
    const mine = document.createElement('div')
    mine.setAttribute('data-conversation-session', 'mine')
    const source = node('source', '重复句')
    const quote = node('quote', '引用 重复句')
    mine.append(source, quote)
    document.body.replaceChildren(other, mine)
    expect(findQuoteSource(document, '重复句', quote)).toBe(source)
  })

  it('returns null when nothing is loaded that matches', () => {
    mount(node('a', '别的内容'))
    expect(findQuoteSource(document, '不存在')).toBeNull()
  })

  it('returns null for a body without a text line instead of matching everything', () => {
    mount(node('a', '任意内容'))
    expect(findQuoteSource(document, '```\n```')).toBeNull()
  })
})

describe('textRangeOf', () => {
  it('spans inline elements', () => {
    const el = message('<p>先给<span>结论</span>：把 O(n²)</p>')
    expect(textRangeOf(el, '先给结论：把')?.toString()).toBe('先给结论：把')
  })

  it('collapses whitespace for matching but keeps the original spacing in the range', () => {
    const el = message('<p>先给   结论</p>')
    expect(textRangeOf(el, '先给 结论')?.toString()).toBe('先给   结论')
  })

  it('spans text nodes with whitespace at the boundary', () => {
    const el = message('<p>先给 <span> 结论</span></p>')
    expect(textRangeOf(el, '先给 结论')?.toString()).toBe('先给  结论')
  })

  it('returns null when the text is absent or the key is empty', () => {
    const el = message('<p>先给结论</p>')
    expect(textRangeOf(el, '不存在')).toBeNull()
    expect(textRangeOf(el, '')).toBeNull()
  })
})

describe('revealElement', () => {
  it('does nothing when scrollIntoView and animate are missing', () => {
    expect(() => revealElement(document.createElement('div'), '任意文字')).not.toThrow()
  })

  it('scrolls to the center and flashes an outline when the Custom Highlight API is missing', () => {
    const el = message('<p>先给结论：把 O(n²) 改成 O(n log n)</p>')
    el.scrollIntoView = vi.fn()
    el.animate = vi.fn()
    revealElement(el, '先给结论')
    expect(el.scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' })
    expect(el.animate).toHaveBeenCalledTimes(1)
    expect(el.animate).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ outline: expect.stringContaining('var(--dsw-alias-brand-primary)') })]),
      { duration: FLASH_DURATION_MS, easing: 'ease-out' },
    )
  })

  it('highlights the exact quoted text when the Custom Highlight API is available', () => {
    const el = message('<p>先给结论：把 O(n²) 改成 O(n log n)</p>')
    el.scrollIntoView = vi.fn()
    el.animate = vi.fn()
    const set = vi.fn()
    const remove = vi.fn()
    const cssDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'CSS')
    const highlightDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'Highlight')
    Object.defineProperty(globalThis, 'CSS', {
      configurable: true,
      writable: true,
      value: { highlights: { set, delete: remove } },
    })
    Object.defineProperty(globalThis, 'Highlight', {
      configurable: true,
      writable: true,
      value: class { constructor(readonly range: Range) {} },
    })
    vi.useFakeTimers()
    try {
      revealElement(el, '先给结论')
      expect(el.scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' })
      expect(set).toHaveBeenCalledTimes(1)
      expect(set.mock.calls[0]?.[0]).toBe(HIGHLIGHT_NAME)
      expect((set.mock.calls[0]?.[1] as { range: Range }).range.toString()).toBe('先给结论')
      expect(el.animate).not.toHaveBeenCalled()
      expect(remove).not.toHaveBeenCalled()
      vi.advanceTimersByTime(FLASH_DURATION_MS)
      expect(remove).toHaveBeenCalledWith(HIGHLIGHT_NAME)
    } finally {
      vi.useRealTimers()
      restoreGlobal('CSS', cssDescriptor)
      restoreGlobal('Highlight', highlightDescriptor)
    }
  })

  it('keeps the scroll when the highlight throws', () => {
    const el = message('<p>任意文字</p>')
    el.scrollIntoView = vi.fn()
    el.animate = () => { throw new Error('unsupported keyframes') }
    expect(() => revealElement(el, '任意文字')).not.toThrow()
    expect(el.scrollIntoView).toHaveBeenCalled()
  })

  it('highlights the whole multi-line quote when the source carries it', () => {
    const text = '先给结论：把 O(n²) 改成 O(n log n) 再说第二行'
    const el = message(`<p>${text}</p>`)
    el.scrollIntoView = vi.fn()
    el.animate = vi.fn()
    const set = vi.fn()
    const remove = vi.fn()
    const cssDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'CSS')
    const highlightDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'Highlight')
    Object.defineProperty(globalThis, 'CSS', {
      configurable: true, writable: true, value: { highlights: { set, delete: remove } },
    })
    Object.defineProperty(globalThis, 'Highlight', {
      configurable: true, writable: true, value: class { constructor(readonly range: Range) {} },
    })
    vi.useFakeTimers()
    try {
      revealElement(el, '先给结论：把 O(n²) 改成 O(n log n)\n再说第二行')
      expect((set.mock.calls[0]?.[1] as { range: Range }).range.toString()).toBe(text)
    } finally {
      vi.clearAllTimers()
      vi.useRealTimers()
      restoreGlobal('CSS', cssDescriptor)
      restoreGlobal('Highlight', highlightDescriptor)
    }
  })

  it('highlights a single-line quote past the first 60 code points', () => {
    const text = '甲'.repeat(80)
    const el = message(`<p>${text}</p>`)
    el.scrollIntoView = vi.fn()
    el.animate = vi.fn()
    const set = vi.fn()
    const remove = vi.fn()
    const cssDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'CSS')
    const highlightDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'Highlight')
    Object.defineProperty(globalThis, 'CSS', {
      configurable: true, writable: true, value: { highlights: { set, delete: remove } },
    })
    Object.defineProperty(globalThis, 'Highlight', {
      configurable: true, writable: true, value: class { constructor(readonly range: Range) {} },
    })
    vi.useFakeTimers()
    try {
      revealElement(el, text)
      expect((set.mock.calls[0]?.[1] as { range: Range }).range.toString()).toBe(text)
    } finally {
      vi.clearAllTimers()
      vi.useRealTimers()
      restoreGlobal('CSS', cssDescriptor)
      restoreGlobal('Highlight', highlightDescriptor)
    }
  })
})
