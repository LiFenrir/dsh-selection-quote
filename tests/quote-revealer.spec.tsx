// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { UseSession } from '@deepseek-ai/dsh-client-ui-session/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { QuoteRevealer } from '../src/client/QuoteRevealer'

const SID = 'session-1' as SessionId
// Stub for the session scope hook: the revealer only reads `sessionId`.
const useSession = ((select: (session: { sessionId: SessionId }) => SessionId): SessionId =>
  select({ sessionId: SID })) as unknown as UseSession

interface MountOptions {
  /** Session container id; `null` leaves the message without a container. */
  session?: string | null
  /** Text rendered inside `[data-quote-preview-text]`. */
  text?: string
}

interface Mounted {
  message: HTMLElement
  preview: HTMLElement
  body: HTMLElement
}

/** Markup the official message-quotes renderer produces for one sent quote. */
function mountQuote({ session = SID, text = '先给结论' }: MountOptions = {}): Mounted {
  const message = document.createElement('div')
  message.setAttribute('data-chat-node-key', 'node-1')
  const preview = document.createElement('span')
  preview.setAttribute('data-quote-preview', '')
  const body = document.createElement('span')
  body.setAttribute('data-quote-preview-text', '')
  body.textContent = text
  preview.append(body)
  message.append(preview)
  if (session === null) {
    document.body.append(message)
  } else {
    const owner = document.createElement('div')
    owner.setAttribute('data-conversation-session', session)
    owner.append(message)
    document.body.append(owner)
  }
  return { message, preview, body }
}

function revealer(reveal: (sessionId: SessionId, body: string, before: Element) => void) {
  return render(<QuoteRevealer useSession={useSession} reveal={reveal} />)
}

afterEach(() => {
  cleanup()
  window.getSelection()?.removeAllRanges()
  document.body.replaceChildren()
})

describe('QuoteRevealer', () => {
  it('reveals the quoted source of the clicked message', () => {
    const reveal = vi.fn()
    revealer(reveal)
    const { message, body } = mountQuote()
    fireEvent.click(body)
    expect(reveal).toHaveBeenCalledTimes(1)
    expect(reveal).toHaveBeenCalledWith(SID, '先给结论', message)
  })

  it('reveals when the quote icon or preview root is clicked', () => {
    const reveal = vi.fn()
    revealer(reveal)
    const { preview } = mountQuote()
    fireEvent.click(preview)
    expect(reveal).toHaveBeenCalledTimes(1)
  })

  it('ignores a quote inside the composer', () => {
    const reveal = vi.fn()
    revealer(reveal)
    const composer = document.createElement('div')
    composer.setAttribute('contenteditable', 'true')
    const message = document.createElement('div')
    message.setAttribute('data-chat-node-key', 'draft')
    const preview = document.createElement('span')
    preview.setAttribute('data-quote-preview', '')
    const body = document.createElement('span')
    body.setAttribute('data-quote-preview-text', '')
    body.textContent = '草稿引用'
    preview.append(body)
    message.append(preview)
    composer.append(message)
    document.body.append(composer)
    fireEvent.click(body)
    expect(reveal).not.toHaveBeenCalled()
  })

  it('ignores a click that ended a drag selection', () => {
    const reveal = vi.fn()
    revealer(reveal)
    const { preview, body } = mountQuote()
    const range = document.createRange()
    range.selectNodeContents(preview)
    window.getSelection()?.addRange(range)
    fireEvent.click(body)
    expect(reveal).not.toHaveBeenCalled()
  })

  it('ignores a quote owned by another mounted session', () => {
    const reveal = vi.fn()
    revealer(reveal)
    const { body } = mountQuote({ session: 'session-2' })
    fireEvent.click(body)
    expect(reveal).not.toHaveBeenCalled()
  })

  it('still reveals when the message has no session container', () => {
    const reveal = vi.fn()
    revealer(reveal)
    const { message, body } = mountQuote({ session: null })
    fireEvent.click(body)
    expect(reveal).toHaveBeenCalledWith(SID, '先给结论', message)
  })

  it('ignores non-left clicks', () => {
    const reveal = vi.fn()
    revealer(reveal)
    const { body } = mountQuote()
    fireEvent.click(body, { button: 2 })
    fireEvent.click(body, { button: 1 })
    expect(reveal).not.toHaveBeenCalled()
  })

  it('ignores clicks outside a quote preview', () => {
    const reveal = vi.fn()
    revealer(reveal)
    const { message } = mountQuote()
    fireEvent.click(message)
    expect(reveal).not.toHaveBeenCalled()
  })

  it('stops listening after unmount', () => {
    const reveal = vi.fn()
    const { unmount } = revealer(reveal)
    const { body } = mountQuote()
    unmount()
    fireEvent.click(body)
    expect(reveal).not.toHaveBeenCalled()
  })
})
