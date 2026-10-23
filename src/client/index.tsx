/**
 * Client entry. It wires the session-scoped observer and the root-scoped
 * toolbar through one dock, and inserts the quote as a composer chip in the
 * session that owns the selection. Sent messages show the quote as a card.
 * Clicking a chip or a card scrolls back to the quoted message.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-store'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import { createDock, type ApplyOutcome, type BoundQuote, type DockSnapshot } from './dock'
import { buildQuoteReference, decodeQuoteRef, QUOTE_SOURCE, QUOTE_TRIGGER, quoteCodec, type QuoteRef } from './reference'
import { en, zh, type QuoteKey } from './locales'
import { QuoteCard, type QuoteRevealInput } from './quote-card'
import { findQuoteSource, revealElement, type RevealTarget } from './reveal'
import { SelectionObserver } from './observer'
import { quoteBlockOf, quoteTextRule } from './user-text-rule'
import { QuoteToolbar } from './toolbar'

const NS = 'selectionQuote'
/** Older-history pages loaded while looking for a quoted message; beyond this the message counts as missing. */
const LOAD_OLDER_MAX_PAGES = 8

/** Resolves on the next animation frame, so a freshly prepended page has been laid out. */
const nextFrame = (): Promise<void> => new Promise(resolve => { requestAnimationFrame(() => { resolve() }) })

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface GlobalStandardProps {
    /** Dock snapshot for root-scoped surfaces; provided by {@link apply} through `provideRoot`. */
    useSelectionQuote: SnapshotSelectorHook<DockSnapshot>
  }

  interface LocaleNamespaceMap {
    'selectionQuote': QuoteKey
  }
}

/** Services this plugin injects from the client root. */
export const inject = ['slots', 'locale', 'sessions', 'conversation', 'inputTriggers', 'uiConversation']

/**
 * Register the dictionary, the chip source, the sent-message card, the dock,
 * and both slot entries.
 *
 * The dock is published to the root as `useSelectionQuote`. Only one selection
 * can be offered at a time, so `bound` tracks the observer that currently owns
 * it; it is cleared when that observer unmounts or switches session.
 *
 * @param ctx - client root context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'selection-quote: locale')
  const t = ctx.locale.bind(NS)
  const dock = createDock()
  let bound: BoundQuote | undefined

  const bind = (next: BoundQuote): void => { bound = next }
  const unbind = (sessionId: SessionId): void => {
    if (bound?.sessionId === sessionId) bound = undefined
  }

  // Resolves the session's composer through the binding that is live now,
  // never through a cached facade: a switched or released session must not be
  // written to.
  const insertQuote = (sessionId: SessionId): ApplyOutcome | 'locked' => {
    if (bound === undefined || bound.sessionId !== sessionId) return 'stale'
    const binding = ctx.sessions.binding(sessionId)
    if (binding === undefined) return 'stale'
    const input = ctx.conversation.input.for(binding.ctx)
    if (input.state.getSnapshot().phase !== 'plain') {
      input.notify('info', t('notice.busy'))
      return 'locked'
    }
    const offer = bound.offer()
    if (offer === undefined || !offer.isAnchored()) return 'stale'
    const reference = buildQuoteReference(offer.payload)
    const span = offer.captureInsertion()
    const inserted = binding.ctx.bail(binding.ctx, 'slash/input-insert-reference', { reference, span }) === true
    if (!inserted) {
      input.notify('error', t('notice.insertFailed'))
      return 'failed'
    }
    offer.markApplied()
    input.focus()
    return 'inserted'
  }

  const applyQuote = (sessionId: SessionId): ApplyOutcome | 'locked' => {
    const outcome = insertQuote(sessionId)
    dock.hide()
    return outcome
  }

  // Shared by the chip and the card. Loads older history only while the quoted
  // message is missing and the session still has pages; a session that was
  // released meanwhile is not written to.
  const reveal = async (sessionId: SessionId, target: RevealTarget, before?: Element): Promise<void> => {
    const binding = ctx.sessions.binding(sessionId)
    if (binding === undefined) return
    let found = findQuoteSource(document, target, before)
    for (let page = 0; found === null && binding.session.getSnapshot().hasMore && page < LOAD_OLDER_MAX_PAGES; page++) {
      await binding.session.loadOlder()
      await nextFrame()
      found = findQuoteSource(document, target, before)
    }
    if (found !== null) {
      revealElement(found)
      return
    }
    const live = ctx.sessions.binding(sessionId)
    if (live !== undefined) ctx.conversation.input.for(live.ctx).notify('info', t('notice.sourceMissing'))
  }

  // A chip whose ref does not decode belongs to another source; returning false lets it fall through.
  const revealFromRef = (ref: string, sessionId: SessionId): boolean => {
    let decoded: QuoteRef
    try {
      decoded = decodeQuoteRef(ref)
    } catch {
      return false
    }
    const block = quoteBlockOf(decoded.text)
    void reveal(sessionId, {
      body: block?.body ?? '',
      role: block?.role,
      nodeKey: decoded.nodeKey,
      flowKind: decoded.flowKind,
    })
    return true
  }

  const revealQuote = (input: QuoteRevealInput): void => {
    void reveal(input.sessionId, { body: input.body, role: input.role }, input.before)
  }

  ctx.effect(() => ctx.inputTriggers.registerSource({
    trigger: QUOTE_TRIGGER,
    name: QUOTE_SOURCE,
    order: 200,
    showGroupTitle: false,
    candidates: async () => [],
    onPick: () => undefined,
    openReference: (session, reference) => revealFromRef(reference.ref, session.sessionId),
    codec: quoteCodec,
  }), 'selection-quote: reference source')
  ctx.effect(() => ctx.uiConversation.userText.register(quoteTextRule), 'selection-quote: user-text rule')
  ctx.slots.inject('conversation.user.text.node', () => ctx.slots.register({
    name: 'conversation.user.text.node',
    key: 'selection-quote',
    priority: 100,
    locale: NS,
    inject: () => ({ revealQuote }),
  }, QuoteCard))

  ctx.slots.provideRoot({ hooks: { selectionQuote: dock } })
  ctx.slots.inject('conversation.input.overlay', () => ctx.slots.register({
    name: 'conversation.input.overlay',
    id: 'selection-quote-observer',
    locale: NS,
    inject: () => ({ dock, bind, unbind }),
  }, SelectionObserver))
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'selection-quote-toolbar',
    locale: NS,
    inject: () => ({ applyQuote, dismiss: () => { dock.hide() } }),
  }, QuoteToolbar))
}
