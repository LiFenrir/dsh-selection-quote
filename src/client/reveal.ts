/**
 * Locate the message a quote came from and bring it into view. The lookup only
 * reads the DOM; the reveal scrolls and briefly highlights the exact quoted
 * text, and never changes the message's class or inline style.
 */

/** Length of the highlight, in ms. */
export const FLASH_DURATION_MS = 3000
/** Registered CSS highlight name; the injected stylesheet styles it. */
export const HIGHLIGHT_NAME = 'dsh-selection-quote-source'
/**
 * Code points of the quote's first line used for matching. A prefix survives
 * the markdown rendering of the tail of a line, which the whole line would not.
 */
const MATCH_CODE_POINTS = 60
/** A fence line such as ```` ```ts ````; the same rule as the quote preview. */
const FENCE_LINE = /^`{3,}/
const NODE_SELECTOR = '[data-chat-node-key]'
const SESSION_SELECTOR = '[data-conversation-session]'

/** Source position of one normalized character. */
interface CharPosition {
  readonly node: Text
  readonly offset: number
}

/** Pending removal of the current text highlight. */
let highlightTimer: ReturnType<typeof setTimeout> | undefined

/**
 * Text key that finds a message: the first non-empty line that is not a code
 * fence, whitespace-collapsed and cut to {@link MATCH_CODE_POINTS}. The line
 * choice keeps markdown-only lines from masking the quoted prose.
 *
 * @param body - quoted body without delimiters.
 * @returns the key, or an empty string when the body has no text line.
 */
export function matchKey(body: string): string {
  const line = body.split('\n').find(item => item.trim() !== '' && !FENCE_LINE.test(item)) ?? ''
  return Array.from(line.replace(/\s+/g, ' ').trim()).slice(0, MATCH_CODE_POINTS).join('')
}

/**
 * Find the message node a quote came from. The official quote carries no
 * node key, so the body key is searched in the text of each message node. With
 * `before`, only nodes that precede it qualify, so a quote finds the message it
 * quoted rather than a later repeat of the same text. A `before` that already
 * left the DOM cannot order anything, so the full transcript is searched.
 *
 * The search is scoped to the conversation session container that holds
 * `before`, so a mounted-but-not-current session cannot supply the match. When
 * `before` is detached or sits outside any session container, the whole
 * document is searched.
 *
 * @param doc - document to search.
 * @param body - quoted body without delimiters.
 * @param before - element the quote sits in; its session scopes the search and
 *   nodes after it are ignored.
 * @returns the matching message node from the same session, or null when none
 *   is loaded.
 */
export function findQuoteSource(doc: Document, body: string, before?: Element): Element | null {
  const key = matchKey(body)
  if (key === '') return null
  const container = before?.closest(SESSION_SELECTOR)
  const scope: ParentNode = container !== null && container !== undefined && container.isConnected ? container : doc
  const nodes = [...scope.querySelectorAll(NODE_SELECTOR)]
  const scoped = before?.isConnected === true
    ? nodes.filter(node => (before.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_PRECEDING) !== 0)
    : nodes
  const matches = scoped.filter(node => (node.textContent ?? '').replace(/\s+/g, ' ').includes(key))
  // Document order: the last match is the nearest one before `before`, or the newest one.
  return matches.at(-1) ?? null
}

/**
 * Turn a match key back into a DOM range inside one message.
 *
 * The message text is collapsed exactly like the match key's source:
 * `textContent` with every whitespace run replaced by one space. Each collapsed
 * character keeps its source text node and offset, so the found key can span
 * inline elements and still produce a precise range.
 *
 * @param root - message node to scan.
 * @param key - normalized key from {@link matchKey}.
 * @returns the range of the key inside `root`, or null when it is absent.
 */
export function textRangeOf(root: Element, key: string): Range | null {
  if (key === '') return null
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const characters: string[] = []
  const positions: CharPosition[] = []
  let previousWasSpace = false
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const text = node as Text
    for (let offset = 0; offset < text.data.length; offset++) {
      const char = text.data[offset]
      if (/\s/.test(char)) {
        if (previousWasSpace) continue
        characters.push(' ')
        previousWasSpace = true
      } else {
        characters.push(char)
        previousWasSpace = false
      }
      positions.push({ node: text, offset })
    }
  }
  const index = characters.join('').indexOf(key)
  if (index < 0) return null
  const start = positions[index]
  const end = positions[index + key.length - 1]
  if (start === undefined || end === undefined) return null
  const range = root.ownerDocument.createRange()
  range.setStart(start.node, start.offset)
  range.setEnd(end.node, end.offset + 1)
  return range
}

/** Minimal view of the Custom Highlight registry, whose TS type omits `set`/`delete`. */
interface HighlightRegistryLike {
  set(name: string, highlight: Highlight): void
  delete(name: string): void
}

/**
 * Paint the range as a text highlight and drop it after the flash duration.
 * A previous highlight is replaced together with its pending removal.
 *
 * @param range - exact source text range.
 * @returns whether the Custom Highlight API accepted the range.
 */
export function highlightRange(range: Range): boolean {
  if (typeof CSS === 'undefined' || typeof Highlight !== 'function') return false
  const registry = (CSS as unknown as { highlights?: HighlightRegistryLike }).highlights
  if (registry === undefined) return false
  try {
    registry.set(HIGHLIGHT_NAME, new Highlight(range))
  } catch {
    return false
  }
  clearTimeout(highlightTimer)
  highlightTimer = setTimeout(() => { registry.delete(HIGHLIGHT_NAME) }, FLASH_DURATION_MS)
  return true
}

/**
 * Pick the widest range the rendered source still carries: the complete quoted
 * body when its collapsed text survives rendering, otherwise the first-line
 * match key used to find the message.
 *
 * @param el - the message node that matched the quote.
 * @param body - quoted body from the official preview.
 * @returns the range to highlight, or null when neither form is present.
 */
function quoteRangeOf(el: Element, body: string): Range | null {
  const key = matchKey(body)
  if (key === '') return null
  const whole = body.replace(/\s+/g, ' ').trim()
  if (whole !== key) {
    const range = textRangeOf(el, whole)
    if (range !== null) return range
  }
  return textRangeOf(el, key)
}

/**
 * Scroll the message to the vertical center and briefly highlight the exact
 * quoted text. When the Custom Highlight API is missing or the text cannot be
 * located, an outline flash on the message marks the location instead.
 *
 * @param el - the message node to bring into view.
 * @param body - quoted body used to find the exact text range.
 */
export function revealElement(el: Element, body: string): void {
  if (typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  const range = quoteRangeOf(el, body)
  if (range !== null && highlightRange(range)) return
  flashOutline(el)
}

/**
 * Fallback affordance: flash an outline on the whole message without changing
 * its class or inline style. The animation's default `fill: none` restores the
 * message once it finishes.
 *
 * @param el - the message node to flash.
 */
function flashOutline(el: Element): void {
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
    // Keyframes with var() can be rejected by some engines; the scroll that
    // already happened stays the outcome.
  }
}
