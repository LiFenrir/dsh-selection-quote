// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { QuoteCardProps, QuoteRevealInput } from '../src/client/quote-card'
import { QuoteCard } from '../src/client/quote-card'
import type { QuoteRole } from '../src/client/user-text-rule'
import { zh } from '../src/client/locales'

// Stub for the namespace-bound `t`: looks keys up in the runtime dictionary.
const dictionary: Record<string, string> = zh
const t = (key: string): string => dictionary[key] ?? key

const SID = 'session-1' as SessionId
// Stub for the session scope hook: the card only reads `sessionId` from it.
const useSession = (select: (session: { sessionId: SessionId }) => SessionId): SessionId => select({ sessionId: SID })

const RAW = '【引用】助手回复 · 第 12 轮\n先给结论\n【/引用】'

function cardProps(
  body: string,
  raw = RAW,
  role?: QuoteRole,
  revealQuote: (input: QuoteRevealInput) => void = vi.fn(),
): QuoteCardProps {
  return {
    node: { id: 'selection-quote', start: 0, end: raw.length, data: { body, role } },
    raw,
    interactive: false,
    t,
    useSession,
    revealQuote,
  } as QuoteCardProps
}

afterEach(() => {
  cleanup()
  window.getSelection()?.removeAllRanges()
})

describe('QuoteCard', () => {
  it('renders the label and only the quoted body', () => {
    const { container } = render(<QuoteCard {...cardProps('先给结论\n第二行')} />)
    expect(screen.getByText('引用')).toBeTruthy()
    expect(container.querySelector('.dsh-quote-card-body')?.textContent).toBe('先给结论\n第二行')
  })

  it('does not render delimiters or the source line', () => {
    const { container } = render(<QuoteCard {...cardProps('先给结论')} />)
    expect(container.textContent).not.toContain('【引用】')
    expect(container.textContent).not.toContain('【/引用】')
    expect(container.textContent).not.toContain('第 12 轮')
    expect(container.textContent).not.toContain('助手回复')
  })

  it('falls back to the raw token when the body is empty', () => {
    const { container } = render(<QuoteCard {...cardProps('')} />)
    expect(container.querySelector('.dsh-quote-card-body')?.textContent).toBe(RAW)
  })

  it('exposes the card as a button labelled with the jump action', () => {
    render(<QuoteCard {...cardProps('先给结论')} />)
    const card = screen.getByRole('button')
    expect(card.getAttribute('aria-label')).toBe('回到原处')
    expect(card.getAttribute('tabindex')).toBe('0')
  })

  it('reveals the quoted body, role and the enclosing node on click', () => {
    const revealQuote = vi.fn()
    const { container } = render(
      <div data-chat-node-key="user-node">
        <QuoteCard {...cardProps('先给结论', RAW, 'assistant', revealQuote)} />
      </div>,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(revealQuote).toHaveBeenCalledTimes(1)
    const input = revealQuote.mock.calls[0][0] as QuoteRevealInput
    expect(input).toMatchObject({ body: '先给结论', role: 'assistant', sessionId: SID })
    expect(input.before).toBe(container.querySelector('[data-chat-node-key]'))
  })

  it('reveals on Enter and on Space', () => {
    const revealQuote = vi.fn()
    render(<QuoteCard {...cardProps('先给结论', RAW, 'user', revealQuote)} />)
    const card = screen.getByRole('button')
    fireEvent.keyDown(card, { key: 'Enter' })
    fireEvent.keyDown(card, { key: ' ' })
    expect(revealQuote).toHaveBeenCalledTimes(2)
  })

  it('ignores other keys', () => {
    const revealQuote = vi.fn()
    render(<QuoteCard {...cardProps('先给结论', RAW, 'user', revealQuote)} />)
    fireEvent.keyDown(screen.getByRole('button'), { key: 'a' })
    expect(revealQuote).not.toHaveBeenCalled()
  })

  it('ignores a click while a text selection covers the card', () => {
    const revealQuote = vi.fn()
    render(<QuoteCard {...cardProps('先给结论', RAW, 'user', revealQuote)} />)
    const card = screen.getByRole('button')
    const range = document.createRange()
    range.selectNodeContents(card)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)
    fireEvent.click(card)
    expect(revealQuote).not.toHaveBeenCalled()
  })
})
