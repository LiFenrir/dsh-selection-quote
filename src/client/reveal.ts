/**
 * Locate the message a quote came from and bring it into view. The lookup only
 * reads the DOM; the reveal scrolls and flashes one node without changing its
 * class or inline style.
 */
import type { FlowKind } from './format'
import type { QuoteRole } from './user-text-rule'

/** Length of the highlight animation, in ms. */
export const FLASH_DURATION_MS = 1200
/**
 * Code points of the quote's first line used for matching. A prefix survives
 * the markdown rendering of the tail of a line, which the whole line would not.
 */
const MATCH_CODE_POINTS = 60
/** A fence line such as ```` ```ts ````; the same rule as the chip preview. */
const FENCE_LINE = /^`{3,}/
const NODE_SELECTOR = '[data-chat-node-key]'
/** Flow kinds a role covers: a quote's role filter maps through this table. */
const ROLE_FLOW_KINDS: Record<QuoteRole, readonly FlowKind[]> = {
  assistant: ['assistant-step'],
  user: ['user', 'steering'],
}

/** What to look for. `nodeKey` is tried first; otherwise the body is matched as text. */
export interface RevealTarget {
  /** Quoted body without delimiters or source line. */
  body: string
  role?: QuoteRole
  nodeKey?: string
  flowKind?: FlowKind
}

/**
 * Text key that finds a message: the first non-empty line that is not a code
 * fence, whitespace-collapsed and cut to {@link MATCH_CODE_POINTS}. The line
 * choice matches the chip preview.
 *
 * @param body - quoted body without delimiters.
 * @returns the key, or an empty string when the body has no text line.
 */
export function matchKey(body: string): string {
  const line = body.split('\n').find(item => item.trim() !== '' && !FENCE_LINE.test(item)) ?? ''
  return Array.from(line.replace(/\s+/g, ' ').trim()).slice(0, MATCH_CODE_POINTS).join('')
}

/**
 * Find the message node a quote came from.
 *
 * The node key is exact when present. Otherwise the body key is searched in the
 * text of each message node, filtered by flow kind or role. With `before`, only
 * nodes that precede it qualify, so a card finds the message it quoted rather
 * than a later repeat of the same text.
 *
 * @param doc - document to search.
 * @param target - the quote's body and source fields.
 * @param before - element the quote sits in; nodes after it are ignored.
 * @returns the matching message node, or null when none is loaded.
 */
export function findQuoteSource(doc: Document, target: RevealTarget, before?: Element): Element | null {
  const nodes = [...doc.querySelectorAll(NODE_SELECTOR)]
  if (target.nodeKey) {
    const exact = nodes.find(node => node.getAttribute('data-chat-node-key') === target.nodeKey)
    if (exact !== undefined) return exact
  }
  const key = matchKey(target.body)
  if (key === '') return null
  const kinds: readonly string[] | undefined = target.flowKind !== undefined
    ? [target.flowKind]
    : target.role !== undefined ? ROLE_FLOW_KINDS[target.role] : undefined
  const matches = nodes.filter(node => {
    if (before !== undefined && (before.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_PRECEDING) === 0) return false
    if (kinds !== undefined && !kinds.includes(node.getAttribute('data-chat-flow-kind') ?? '')) return false
    return (node.textContent ?? '').replace(/\s+/g, ' ').includes(key)
  })
  // Document order: the last match is the nearest one before `before`, or the newest one.
  return matches.at(-1) ?? null
}

/**
 * Scroll the element into view and flash an outline on it. The outline runs
 * through the Web Animations API so the node keeps its own class and style.
 * Without `scrollIntoView` or `animate` (jsdom, old engines) it does nothing.
 *
 * @param el - the message node to bring into view.
 */
export function revealElement(el: Element): void {
  if (typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  if (typeof el.animate !== 'function') return
  try {
    el.animate(
      [
        { outline: '2px solid var(--dsw-alias-brand-primary)', outlineOffset: '3px' },
        { outline: '2px solid transparent', outlineOffset: '3px' },
      ],
      { duration: FLASH_DURATION_MS, easing: 'ease-out' },
    )
  } catch {
    // Keyframes with var() can be rejected by some engines; the highlight is
    // decoration, so the scroll that already happened stays the outcome.
  }
}
