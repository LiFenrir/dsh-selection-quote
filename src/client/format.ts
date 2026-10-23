/**
 * Pure serializer for quote blocks. Keeping it free of DOM and React means the
 * same rules are exercised by node tests and by the live insertion path.
 *
 * The output is plain text. The composer displays it verbatim, so nothing here
 * escapes HTML entities: a quoted `<b>` must reach the model unchanged.
 */

/** Every `data-chat-flow-kind` value a quote may come from. */
export const FLOW_KINDS = ['user', 'steering', 'assistant-step'] as const

/** Position of the quoted message in the conversation. */
export type FlowKind = (typeof FLOW_KINDS)[number]

/** Delimiters and labels, resolved from the active locale by the caller. */
export interface QuoteMessages {
  /** Opening delimiter that starts a quote block, e.g. `【引用】`. */
  open: string
  /** Closing delimiter that ends a quote block, e.g. `【/引用】`. */
  close: string
  /** Replacement for an opening delimiter found inside quoted text. Same length as `open`. */
  escapeOpen: string
  /** Replacement for a closing delimiter found inside quoted text. Same length as `close`. */
  escapeClose: string
  /** Role label for a user or steering message. */
  user: string
  /** Role label for an assistant message. */
  assistant: string
  /** Template with a `{count}` placeholder, appended after truncated text. */
  truncated: string
}

/** Input for {@link formatQuoteBody}. */
export interface FormatQuoteInput {
  /** Raw selected text. Used when `code` is absent. */
  raw: string
  flowKind: FlowKind
  /**
   * Set when the selection covers an entire code block. The fenced body is
   * then `code.text`, and `raw` is ignored.
   */
  code?: { lang?: string; text: string }
  messages: QuoteMessages
  /** Maximum code points kept before truncation. Defaults to {@link DEFAULT_QUOTE_LIMIT}. */
  limit?: number
}

/**
 * Upper bound on quoted code points. Long enough for a typical code block;
 * short enough that one quote cannot swamp the composer.
 */
export const DEFAULT_QUOTE_LIMIT = 4000

/**
 * Collapse runs of three or more newlines into one blank line. Leading and
 * trailing whitespace is removed so the block boundary is decided by the
 * serializer, not by the DOM.
 *
 * @param raw - selected text as extracted from the DOM.
 * @returns text with at most one blank line between paragraphs.
 */
export function normalize(raw: string): string {
  return raw.trim().replace(/\n{3,}/g, '\n\n')
}

/**
 * Keep the first `limit` code points and append the truncation note.
 *
 * Code points, not UTF-16 units, so an emoji is never split. The note reports
 * the length of the full text.
 *
 * @param text - text to limit.
 * @param limit - maximum number of code points to keep.
 * @param messages - supplies the truncation template.
 * @returns the original text when it fits, otherwise the truncated text plus the note.
 */
export function truncate(text: string, limit: number, messages: QuoteMessages): string {
  const chars = Array.from(text)
  if (chars.length <= limit) return text
  const note = fill(messages.truncated, { count: String(chars.length) })
  return `${chars.slice(0, limit).join('')}\n${note}`
}

/**
 * Build the quoted body: normalize or take the code text, truncate, escape the
 * delimiters, and fence code when present.
 *
 * @param input - selection and locale messages.
 * @returns body text without the open and close delimiters.
 */
export function formatQuoteBody(input: FormatQuoteInput): string {
  const limit = input.limit ?? DEFAULT_QUOTE_LIMIT
  const { messages } = input
  if (input.code === undefined) {
    return escapeDelimiters(truncate(normalize(input.raw), limit, messages), messages)
  }
  const body = escapeDelimiters(truncate(input.code.text, limit, messages), messages)
  const fence = fenceFor(body)
  return `${fence}${input.code.lang ?? ''}\n${body}\n${fence}`
}

/**
 * Localized role of the quoted message.
 *
 * @param flowKind - message kind; `assistant-step` maps to the assistant label, everything else to the user label.
 * @param messages - supplies role labels.
 * @returns the role label without any turn information.
 */
export function roleLabel(flowKind: FlowKind, messages: QuoteMessages): string {
  return flowKind === 'assistant-step' ? messages.assistant : messages.user
}

/**
 * Build the source line that follows the open delimiter. Only the role is
 * written: the model needs to know who said the quoted text, not where it sits
 * in the conversation, and turn numbers would leak into the UI title.
 *
 * @param flowKind - message kind; see {@link roleLabel}.
 * @param messages - supplies role labels.
 * @returns e.g. `助手回复` or `用户消息`.
 */
export function composeSourceLabel(flowKind: FlowKind, messages: QuoteMessages): string {
  return roleLabel(flowKind, messages)
}

/**
 * Wrap a body in the delimiters with its source line.
 *
 * @param body - output of {@link formatQuoteBody}.
 * @param sourceLabel - output of {@link composeSourceLabel}.
 * @param messages - supplies the delimiters.
 * @returns the block without a trailing blank line; the caller adds the separator.
 */
export function quoteBlock(body: string, sourceLabel: string, messages: QuoteMessages): string {
  return `${messages.open}${sourceLabel}\n${body}\n${messages.close}`
}

/**
 * Replace delimiter strings found inside quoted text so the block boundary
 * stays unambiguous. Escape strings are the same length as the originals.
 *
 * @param body - text to escape.
 * @param messages - supplies the delimiters and their replacements.
 * @returns body with every open and close delimiter replaced.
 */
function escapeDelimiters(body: string, messages: QuoteMessages): string {
  return body.split(messages.open).join(messages.escapeOpen).split(messages.close).join(messages.escapeClose)
}

/**
 * Pick a fence longer than any backtick run in the body, so code that itself
 * contains triple backticks cannot close the block early.
 *
 * @param body - fenced content.
 * @returns at least three backticks.
 */
function fenceFor(body: string): string {
  let longest = 0
  for (const run of body.matchAll(/`+/g)) longest = Math.max(longest, run[0].length)
  return '`'.repeat(Math.max(3, longest + 1))
}

/**
 * Substitute `{name}` placeholders. Unknown placeholders are left in place.
 *
 * @param template - text with `{name}` placeholders.
 * @param params - values keyed by placeholder name.
 * @returns the substituted string.
 */
function fill(template: string, params: Record<string, string>): string {
  let out = template
  for (const [name, value] of Object.entries(params)) out = out.split(`{${name}}`).join(value)
  return out
}
