// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-store'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { DockSnapshot, QuoteRect, QuoteSelection } from '../src/client/dock'
import { zh } from '../src/client/locales'
import { QuoteToolbar, placeToolbar } from '../src/client/toolbar'

const SESSION = 's1' as SessionId
const VIEWPORT = { width: 1000, height: 800 }
const RECT: QuoteRect = { top: 300, left: 400, right: 600, bottom: 320, width: 200, height: 20 }

// Stub for the namespace-bound `t`: looks keys up in the runtime dictionary.
const dictionary: Record<string, string> = zh
const t = (key: string): string => dictionary[key] ?? key

function selectionOf(rect: QuoteRect = RECT): QuoteSelection {
  return {
    text: '正文',
    sourceLabel: '助手回复',
    nodeKey: 'n1',
    flowKind: 'assistant-step',
    rect,
    sessionId: SESSION,
    capturedAt: 0,
  }
}

function hookOf(snapshot: DockSnapshot): SnapshotSelectorHook<DockSnapshot> {
  return selector => selector(snapshot)
}

afterEach(() => {
  cleanup()
})

describe('placeToolbar', () => {
  it('centers above the selection with an 8px gap', () => {
    expect(placeToolbar(RECT, { width: 100, height: 30 }, VIEWPORT)).toEqual({ top: 300 - 8 - 30, left: 450 })
  })

  it('flips below when there is no room above', () => {
    const top = { ...RECT, top: 20, bottom: 40 }
    expect(placeToolbar(top, { width: 100, height: 30 }, VIEWPORT)).toEqual({ top: 40 + 8, left: 450 })
  })

  it('clamps to the left viewport margin', () => {
    const left = { ...RECT, left: 0, right: 20, width: 20 }
    expect(placeToolbar(left, { width: 100, height: 30 }, VIEWPORT).left).toBe(8)
  })

  it('clamps to the right viewport margin', () => {
    const right = { ...RECT, left: 980, right: 1000, width: 20 }
    expect(placeToolbar(right, { width: 100, height: 30 }, VIEWPORT).left).toBe(1000 - 100 - 8)
  })
})

describe('QuoteToolbar', () => {
  it('renders nothing while idle', () => {
    const { container } = render(
      <QuoteToolbar useSelectionQuote={hookOf({ phase: 'idle' })} applyQuote={vi.fn(() => 'inserted' as const)} dismiss={vi.fn()} t={t} />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('exposes a labelled toolbar with the quote and close actions', () => {
    render(
      <QuoteToolbar useSelectionQuote={hookOf({ phase: 'visible', selection: selectionOf() })} applyQuote={vi.fn(() => 'inserted' as const)} dismiss={vi.fn()} t={t} />,
    )
    const toolbar = screen.getByRole('toolbar', { name: '划词引用' })
    expect(toolbar).toBeTruthy()
    expect(screen.getByRole('button', { name: '引用' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '关闭' })).toBeTruthy()
  })

  it('cancels pointer-down so the selection survives the click', () => {
    render(
      <QuoteToolbar useSelectionQuote={hookOf({ phase: 'visible', selection: selectionOf() })} applyQuote={vi.fn(() => 'inserted' as const)} dismiss={vi.fn()} t={t} />,
    )
    const notPrevented = fireEvent.pointerDown(screen.getByRole('toolbar'))
    expect(notPrevented).toBe(false)
  })

  it('applies the quote for the selection session when the button is clicked', () => {
    const applyQuote = vi.fn(() => 'inserted' as const)
    render(
      <QuoteToolbar useSelectionQuote={hookOf({ phase: 'visible', selection: selectionOf() })} applyQuote={applyQuote} dismiss={vi.fn()} t={t} />,
    )
    fireEvent.click(screen.getByRole('button', { name: '引用' }))
    expect(applyQuote).toHaveBeenCalledWith(SESSION)
  })

  it('dismisses from the close button', () => {
    const dismiss = vi.fn()
    render(
      <QuoteToolbar useSelectionQuote={hookOf({ phase: 'visible', selection: selectionOf() })} applyQuote={vi.fn(() => 'inserted' as const)} dismiss={dismiss} t={t} />,
    )
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(dismiss).toHaveBeenCalledTimes(1)
  })

  it('dismisses on Escape pressed inside the toolbar', () => {
    const dismiss = vi.fn()
    render(
      <QuoteToolbar useSelectionQuote={hookOf({ phase: 'visible', selection: selectionOf() })} applyQuote={vi.fn(() => 'inserted' as const)} dismiss={dismiss} t={t} />,
    )
    fireEvent.keyDown(screen.getByRole('toolbar'), { key: 'Escape' })
    expect(dismiss).toHaveBeenCalled()
  })

  it('dismisses on a pointer-down outside the toolbar', () => {
    const dismiss = vi.fn()
    render(
      <QuoteToolbar useSelectionQuote={hookOf({ phase: 'visible', selection: selectionOf() })} applyQuote={vi.fn(() => 'inserted' as const)} dismiss={dismiss} t={t} />,
    )
    fireEvent.pointerDown(document.body)
    expect(dismiss).toHaveBeenCalled()
  })

  it('does not dismiss on a pointer-down inside the toolbar', () => {
    const dismiss = vi.fn()
    render(
      <QuoteToolbar useSelectionQuote={hookOf({ phase: 'visible', selection: selectionOf() })} applyQuote={vi.fn(() => 'inserted' as const)} dismiss={dismiss} t={t} />,
    )
    fireEvent.pointerDown(screen.getByRole('button', { name: '引用' }))
    expect(dismiss).not.toHaveBeenCalled()
  })

  it('dismisses on scroll and resize', () => {
    const dismiss = vi.fn()
    render(
      <QuoteToolbar useSelectionQuote={hookOf({ phase: 'visible', selection: selectionOf() })} applyQuote={vi.fn(() => 'inserted' as const)} dismiss={dismiss} t={t} />,
    )
    window.dispatchEvent(new Event('scroll'))
    window.dispatchEvent(new Event('resize'))
    expect(dismiss).toHaveBeenCalledTimes(2)
  })

  it('shows a status hint without actions for a cross-message selection', () => {
    render(
      <QuoteToolbar useSelectionQuote={hookOf({ phase: 'blocked', reason: 'cross-node', rect: RECT })} applyQuote={vi.fn(() => 'inserted' as const)} dismiss={vi.fn()} t={t} />,
    )
    expect(screen.getByRole('status').textContent).toBe('请在同一段消息内选择')
    expect(screen.queryByRole('button')).toBeNull()
  })
})
