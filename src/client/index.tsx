/**
 * Client entry. DSH already owns selection quoting: it inserts the composer
 * quote and renders sent quotes through `conversation.user.text.node`. This
 * plugin adds only the missing gesture: clicking such a quote scrolls back to
 * the text it quoted, centered in the transcript.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import { en, zh, type QuoteKey } from './locales'
import { QuoteRevealer } from './QuoteRevealer'
import { findQuoteSource, HIGHLIGHT_NAME, revealElement } from './reveal'

const NS = 'selectionQuote'
/** Older-history pages loaded while looking for a quoted message; beyond this the source counts as missing. */
const LOAD_OLDER_MAX_PAGES = 8

/** Resolves on the next animation frame, so a freshly prepended page has been laid out. */
const nextFrame = (): Promise<void> => new Promise(resolve => { requestAnimationFrame(() => { resolve() }) })

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'selectionQuote': QuoteKey
  }
}

/** Services this plugin injects from the client root. */
export const inject = ['slots', 'locale', 'sessions', 'conversation']

/**
 * Register the dictionary, the pointer affordance, and the session-scoped
 * click observer. Nothing is inserted into the composer and no quote is
 * rendered: the official message-quotes plugin owns both.
 *
 * @param ctx - client root context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'selection-quote: locale')
  const t = ctx.locale.bind(NS)

  // Loads older history only while the quoted message is missing and the session
  // still has pages; a session that was released meanwhile is not written to.
  const reveal = (sessionId: SessionId, body: string, before: Element): void => {
    void (async () => {
      const binding = ctx.sessions.binding(sessionId)
      if (binding === undefined) return
      let found = findQuoteSource(document, body, before)
      for (let page = 0; found === null && binding.session.getSnapshot().hasMore && page < LOAD_OLDER_MAX_PAGES; page++) {
        await binding.session.loadOlder()
        await nextFrame()
        found = findQuoteSource(document, body, before)
      }
      if (found !== null) {
        revealElement(found, body)
        return
      }
      const live = ctx.sessions.binding(sessionId)
      if (live !== undefined) ctx.conversation.input.for(live.ctx).notify('info', t('notice.sourceMissing'))
    })()
  }

  // The official preview is inert by default; the pointer marks it as the jump
  // affordance this plugin adds.
  ctx.effect(() => {
    const style = document.createElement('style')
    style.textContent = [
      '[data-chat-node-key] [data-quote-preview]{cursor:pointer}',
      `::highlight(${HIGHLIGHT_NAME}){background-color: color-mix(in srgb, var(--dsw-alias-state-business-primary) 24%, transparent);}`,
    ].join('\n')
    document.head.append(style)
    return () => { style.remove() }
  }, 'selection-quote: affordance')

  ctx.slots.inject('conversation.input.overlay', () => ctx.slots.register({
    name: 'conversation.input.overlay',
    id: 'selection-quote-reveal',
    inject: () => ({ reveal }),
  }, QuoteRevealer))
}
