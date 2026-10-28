/**
 * Reads the official message-quote DOM rendered for a sent user message. Only a
 * quote preview inside a chat message is a jump target; the editable quote in
 * the composer keeps its normal editing behavior.
 */
const QUOTE_SELECTOR = '[data-quote-preview]'
const QUOTE_TEXT_SELECTOR = '[data-quote-preview-text]'
const MESSAGE_SELECTOR = '[data-chat-node-key]'
const EDITABLE_SELECTOR = '[contenteditable="true"]'

/** One rendered quote preview and the message that holds it. */
export interface QuoteTarget {
  /** Root of the quote preview; used to tell a click from a drag selection. */
  readonly preview: Element
  /** Exact quoted text from the official preview. */
  readonly text: string
  /** Message node holding the preview; the source is searched above it. */
  readonly before: Element
}

/**
 * Resolve the quote preview a click landed on.
 *
 * @param target - the click's event target.
 * @returns the preview, its text and its message; `null` for anything else.
 */
export function quoteTargetOf(target: EventTarget | null): QuoteTarget | null {
  if (!(target instanceof Element)) return null
  const preview = target.closest(QUOTE_SELECTOR)
  if (preview === null) return null
  if (preview.closest(EDITABLE_SELECTOR) !== null) return null
  const before = preview.closest(MESSAGE_SELECTOR)
  if (before === null) return null
  const text = preview.querySelector(QUOTE_TEXT_SELECTOR)?.textContent ?? ''
  if (text.trim() === '') return null
  return { preview, text, before }
}

/**
 * Check whether a non-collapsed selection intersects the element, i.e. the
 * click ended a drag selection rather than activating the quote.
 *
 * @param el - element to test.
 * @returns whether the document selection covers any of `el`.
 */
export function selectionCovers(el: Element): boolean {
  const selection = window.getSelection()
  if (selection === null || selection.isCollapsed || selection.rangeCount === 0) return false
  return selection.getRangeAt(0).intersectsNode(el)
}
