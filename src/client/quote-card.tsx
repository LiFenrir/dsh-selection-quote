/**
 * Renders a quote block in a sent user message as a card. Only the quoted body
 * is shown; the source line and delimiters remain in the model-facing text.
 * A click or Enter/Space on the card jumps back to the quoted message.
 */
import type { KeyboardEvent, MouseEvent } from 'react'
import type { PropsRuntime, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { UseSession } from '@deepseek-ai/dsh-client-ui-session/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { QuoteRole } from './user-text-rule'

/** What the card asks the session to reveal: the quoted body, its role, and where the card sits. */
export interface QuoteRevealInput {
  body: string
  role?: QuoteRole
  sessionId: SessionId
  /** The message node that holds the card; the quoted message is searched above it. */
  before?: Element
}

export type QuoteCardProps = PropsRuntime<'conversation.user.text.node', 'selection-quote'> & {
  t: TranslateNS<'selectionQuote'>
  /** Session scope hook; the card reads its own session id from it. */
  useSession: UseSession
  /** Injected by `index.tsx`; scrolls to the quoted message in the card's session. */
  revealQuote: (input: QuoteRevealInput) => void
}

/**
 * Component-local stylesheet. Only theme tokens are referenced, so the card
 * follows the active light or dark theme.
 */
const QUOTE_CARD_CSS = `
.dsh-quote-card {
  display: inline-flex;
  flex-direction: column;
  gap: 4px;
  max-width: 100%;
  box-sizing: border-box;
  vertical-align: top;
  padding: 6px 10px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: var(--dsw-radius-md);
  background: var(--dsw-alias-bg-layer-2);
  cursor: pointer;
}
.dsh-quote-card:hover {
  border-color: var(--dsw-alias-state-business-primary);
}
.dsh-quote-card:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary);
  outline-offset: 1px;
}
.dsh-quote-card-label {
  font-size: 12px;
  line-height: 1.4;
  color: var(--dsw-alias-label-secondary);
}
.dsh-quote-card-body {
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--dsw-alias-label-primary);
}
`

/**
 * True when a non-collapsed selection touches the element. A click that ends a
 * text selection must not also jump, so the user can select text in the card.
 *
 * @param el - the card element.
 * @returns whether the document selection intersects `el`.
 */
function hasSelectionOn(el: Element): boolean {
  const selection = window.getSelection()
  if (selection === null || selection.isCollapsed) return false
  // `intersectsNode` also holds when the range lies inside `el`, which `containsNode` does not report.
  return selection.getRangeAt(0).intersectsNode(el)
}

/**
 * Render one quote card.
 *
 * `interactive` is deliberately unused: the card has no action, so it renders
 * the same in both modes. An empty body falls back to the raw token so that
 * no quoted text is ever hidden.
 *
 * @param props - resolved node, raw token, locale `t`, session hook and reveal injection.
 * @returns an inline card with a label line and the quoted body.
 */
export function QuoteCard({ node, raw, t, useSession, revealQuote }: QuoteCardProps) {
  const sessionId = useSession(s => s.sessionId)
  const body = node.data.body === '' ? raw : node.data.body
  const reveal = (card: Element): void => {
    revealQuote({
      body: node.data.body,
      role: node.data.role,
      sessionId,
      before: card.closest('[data-chat-node-key]') ?? undefined,
    })
  }
  const onClick = (event: MouseEvent<HTMLDivElement>): void => {
    if (hasSelectionOn(event.currentTarget)) return
    reveal(event.currentTarget)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    // Space would otherwise scroll the page under the card.
    event.preventDefault()
    reveal(event.currentTarget)
  }
  return (
    <>
      <style>{QUOTE_CARD_CSS}</style>
      <div
        className="dsh-quote-card"
        role="button"
        tabIndex={0}
        aria-label={t('card.reveal')}
        onClick={onClick}
        onKeyDown={onKeyDown}
      >
        <span className="dsh-quote-card-label">{t('card.label')}</span>
        <div className="dsh-quote-card-body">{body}</div>
      </div>
    </>
  )
}
