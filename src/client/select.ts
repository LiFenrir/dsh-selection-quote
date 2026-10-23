/**
 * DOM-side reading of the current browser selection. It only inspects the
 * chat's own markers (`data-chat-*`, `.md-code-block`); nothing here writes to
 * the DOM or mutates the selection.
 */
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { QuoteRect } from './dock'
import type { FlowKind } from './format'

/** A selection inside one chat message, before it is serialized. */
export interface CapturedSelection {
  /** Extracted text with banners and controls removed. Code blocks carry their code here too. */
  text: string
  flowKind: FlowKind
  nodeKey: string
  rect: QuoteRect
  /** The message node. Used to detect that streaming replaced it. */
  anchor: Element
  sessionId: SessionId
  /**
   * Set when the selection covers a whole code block. `text` then equals
   * `code.text`, and the serializer fences it.
   */
  code?: { lang?: string; text: string }
}

/** Outcome of reading the selection. */
export type CaptureResult =
  | { kind: 'none' }
  | { kind: 'cross-node'; rect: QuoteRect }
  | { kind: 'selection'; selection: CapturedSelection }

const NODE_SELECTOR = '[data-chat-node-key]'
// Composer, chips, controls and dialogs are never quotable.
const EXCLUDED_SELECTOR = '[contenteditable="true"], [data-ref-chip], button, a, [role="dialog"]'
// Banner labels, copy/wrap buttons and icons are chrome, not message text.
const SKIPPED_SELECTOR = '[data-code-block-banner], button, svg, [aria-hidden="true"]'
const CODE_BLOCK_SELECTOR = '.md-code-block'
const FLOW_KINDS: readonly string[] = ['user', 'steering', 'assistant-step']
const BLOCK_TAGS: ReadonlySet<string> = new Set(['P', 'DIV', 'LI', 'PRE', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TR'])
// Same shape the highlighter emits as a language label; anything else is a
// localized fallback such as "Code" and must not become a fence language.
const LANG_PATTERN = /^[A-Za-z][\w+#.-]{0,19}$/u
const MIN_VISIBLE_CHARS = 2

/**
 * Read the document selection and classify it.
 *
 * Both endpoints must sit inside allowed chat messages. A selection that spans
 * two messages is reported as `cross-node` so the caller can explain why no
 * quote is offered.
 *
 * @param doc - document whose selection is read.
 * @param sessionId - session that owns the chat; copied onto the result.
 * @returns `none` for collapsed, excluded or too-short selections, `cross-node`
 *   for a selection spanning two messages, otherwise the captured selection.
 */
export function captureSelection(doc: Document, sessionId: SessionId): CaptureResult {
  const selection = doc.getSelection()
  if (selection === null || selection.rangeCount === 0 || selection.isCollapsed) return { kind: 'none' }
  const range = selection.getRangeAt(0)
  const startNode = allowedNodeOf(range.startContainer)
  const endNode = allowedNodeOf(range.endContainer)
  if (startNode === undefined || endNode === undefined) return { kind: 'none' }
  const startFlow = flowKindOf(startNode)
  const endFlow = flowKindOf(endNode)
  if (startFlow === undefined || endFlow === undefined) return { kind: 'none' }
  const rect = toRect(range.getBoundingClientRect())
  if (startNode !== endNode) return { kind: 'cross-node', rect }

  const code = codeBlockOf(range)
  const text = code === undefined ? extractText(range) : (code.pre.textContent ?? '').replace(/\n+$/u, '')
  if (text.replace(/\s/gu, '').length < MIN_VISIBLE_CHARS) return { kind: 'none' }

  return {
    kind: 'selection',
    selection: {
      text,
      flowKind: startFlow,
      nodeKey: startNode.getAttribute('data-chat-node-key') ?? '',
      rect,
      anchor: startNode,
      sessionId,
      code: code === undefined ? undefined : { lang: languageOf(code.block), text },
    },
  }
}

/**
 * Find the code block that fully contains the range.
 *
 * A partial selection inside a block returns `undefined`, so the caller quotes
 * it as plain text instead of fencing code the user did not select in full.
 *
 * @param range - selection range.
 * @returns the block and its `<pre>` when the range starts at or before the
 *   code and ends at or after it, both within one block; otherwise `undefined`.
 */
export function codeBlockOf(range: Range): { block: Element; pre: Element } | undefined {
  const startBlock = elementOf(range.startContainer)?.closest(CODE_BLOCK_SELECTOR)
  const endBlock = elementOf(range.endContainer)?.closest(CODE_BLOCK_SELECTOR)
  if (startBlock === undefined || startBlock === null || startBlock !== endBlock) return undefined
  const pre = startBlock.querySelector('[data-code-block-content] pre')
  if (pre === null) return undefined
  const preRange = pre.ownerDocument.createRange()
  preRange.selectNodeContents(pre)
  const covers = range.compareBoundaryPoints(Range.START_TO_START, preRange) <= 0
    && range.compareBoundaryPoints(Range.END_TO_END, preRange) >= 0
  return covers ? { block: startBlock, pre } : undefined
}

/**
 * Check that an element may be the start or end of a quotable selection.
 *
 * @param el - element to test, or `null`.
 * @returns `true` when the element is inside a chat message and not inside a
 *   control, the composer, or a dialog.
 */
export function isAllowedContainer(el: Element | null): el is Element {
  return el !== null && el.closest(EXCLUDED_SELECTOR) === null && el.closest(NODE_SELECTOR) !== null
}

/** Resolve a range endpoint to its chat message, or `undefined` when it is outside one. */
function allowedNodeOf(node: Node): Element | undefined {
  const el = elementOf(node)
  if (!isAllowedContainer(el)) return undefined
  return el.closest(NODE_SELECTOR) ?? undefined
}

/** Return the message's flow kind when it is quotable, otherwise `undefined`. */
function flowKindOf(node: Element): FlowKind | undefined {
  const kind = node.getAttribute('data-chat-flow-kind')
  return kind !== null && FLOW_KINDS.includes(kind) ? (kind as FlowKind) : undefined
}

/**
 * Serialize the range to plain text. Block boundaries and `<br>` become
 * newlines; banners, controls and icons are skipped.
 *
 * @param range - selection range.
 * @returns raw text, not yet normalized.
 */
function extractText(range: Range): string {
  const out: string[] = []
  for (const node of range.cloneContents().childNodes) collect(node, out)
  return out.join('')
}

/**
 * Append the visible text of one node to `out`.
 *
 * @param node - node from the cloned fragment.
 * @param out - accumulator.
 */
function collect(node: Node, out: string[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? ''
    if (text !== '') out.push(text)
    return
  }
  if (!(node instanceof Element) || node.matches(SKIPPED_SELECTOR)) return
  if (node.tagName === 'BR') {
    out.push('\n')
    return
  }
  const block = BLOCK_TAGS.has(node.tagName)
  if (block) breakLine(out)
  for (const child of node.childNodes) collect(child, out)
  if (block) breakLine(out)
}

/** Start a new line unless the accumulated text already ends with one. */
function breakLine(out: string[]): void {
  if (out.length > 0 && !out[out.length - 1].endsWith('\n')) out.push('\n')
}

/**
 * Read the language label from a highlighted code block's banner.
 *
 * Highlighted blocks carry `pre.shiki`. The label is the first banner element's
 * first child (the toolbar layout) or the banner itself (the plain layout), and
 * the class names are hashed, so only the structure is used.
 *
 * @param block - the `.md-code-block` element.
 * @returns the language label, or `undefined` when the block is not highlighted
 *   or the label is not a language name.
 */
function languageOf(block: Element): string | undefined {
  if (block.querySelector('pre.shiki') === null) return undefined
  const head = block.querySelector('[data-code-block-banner]')?.firstElementChild
  if (head === undefined || head === null) return undefined
  const label = (head.firstElementChild ?? head).textContent?.trim() ?? ''
  return LANG_PATTERN.test(label) ? label : undefined
}

/** Nearest element for a node: the node itself, or its parent for text nodes. */
function elementOf(node: Node): Element | null {
  return node instanceof Element ? node : node.parentElement
}

/** Copy the six `DOMRect` fields the toolbar needs into a plain object. */
function toRect(r: DOMRect): QuoteRect {
  return { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height }
}
