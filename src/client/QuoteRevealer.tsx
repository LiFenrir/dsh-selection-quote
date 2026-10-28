/** Session-scoped click observer for the official message-quote previews. */
import { useEffect } from 'react'
import type { UseSession } from '@deepseek-ai/dsh-client-ui-session/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { quoteTargetOf, selectionCovers } from './quote-target'

/** Session container attribute; several conversations can be mounted at once. */
const SESSION_SELECTOR = '[data-conversation-session]'

/** Props for {@link QuoteRevealer}. */
export interface QuoteRevealerProps {
  /** Session scope hook; the clicked quote belongs to this session. */
  useSession: UseSession
  /** Scrolls the quoted source into view for the session that owns the click. */
  reveal: (sessionId: SessionId, body: string, before: Element) => void
}

/**
 * Watch clicks on rendered quote previews in this session. The listener lives on
 * the document because message nodes are virtualized; it is removed with the
 * session scope. Renders nothing.
 *
 * @param props - session hook and the reveal callback.
 * @returns `null`.
 */
export function QuoteRevealer({ useSession, reveal }: QuoteRevealerProps): null {
  const sessionId = useSession(s => s.sessionId)

  useEffect(() => {
    const onClick = (event: MouseEvent): void => {
      if (event.button !== 0) return
      const target = quoteTargetOf(event.target)
      // A click that ended a drag selection belongs to copying, not to the jump.
      if (target === null || selectionCovers(target.preview)) return
      const owner = target.before.closest(SESSION_SELECTOR)
      // A missing container is tolerated; a container for another session is not.
      if (owner !== null && owner.getAttribute('data-conversation-session') !== String(sessionId)) return
      reveal(sessionId, target.text, target.before)
    }
    document.addEventListener('click', onClick)
    return () => { document.removeEventListener('click', onClick) }
  }, [sessionId, reveal])

  return null
}
