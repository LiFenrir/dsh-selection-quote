/**
 * User-text rule that turns a quote block in a sent message into a card.
 *
 * The card shows only the quoted body, so the source line and delimiters
 * stay in the model-facing text but not in the transcript. Both locales'
 * delimiters are recognized because a history written under one locale must
 * still render as a card after the user switches language.
 */
import type { UserTextRule } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { en, zh } from './locales'

/** Role named by a quote's source line; absent when the line is not a known role. */
export type QuoteRole = 'assistant' | 'user'

declare module '@deepseek-ai/dsh-client-ui-conversation/client' {
  interface UserTextDataMap {
    /**
     * One quoted selection. `body` is the quoted text without the delimiters or
     * source line; `role` is set only when the source line names a known role.
     */
    'selection-quote': { readonly body: string; readonly role?: QuoteRole }
  }
}

/** Open and close delimiters of one locale, as written into the model text. */
export interface QuoteDelimiters {
  readonly open: string
  readonly close: string
}

/** A quote block found in the original text, with the body after trailing-newline cleanup. */
interface QuoteMatch {
  readonly start: number
  readonly end: number
  readonly body: string
  readonly role?: QuoteRole
}

/** Longest source line accepted between the open delimiter and the body, in UTF-16 units. */
const SOURCE_LINE_MAX = 120

/**
 * Delimiter pairs of every shipped locale.
 *
 * @returns one pair per locale dictionary, in the order zh then en.
 */
export function quoteMessages(): readonly QuoteDelimiters[] {
  return [zh, en].map(dict => ({ open: dict['format.open'], close: dict['format.close'] }))
}

/**
 * Escape a literal for use inside a RegExp source.
 *
 * @param literal - text to match verbatim.
 * @returns the same text with RegExp syntax characters escaped.
 */
function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Map a source line to a role. Both locales are accepted, so a quote written
 * under one language still names its role after the user switches.
 *
 * @param source - the source line between the open delimiter and the newline.
 * @returns the role, or undefined for any other text (e.g. a legacy line with a turn number).
 */
function roleOf(source: string): QuoteRole | undefined {
  if (source === zh['source.assistant'] || source === en['source.assistant']) return 'assistant'
  if (source === zh['source.user'] || source === en['source.user']) return 'user'
  return undefined
}

/**
 * Find the first quote block at or after `from` for one delimiter pair.
 * Blocks whose body is blank are skipped so a later real quote still matches.
 *
 * @param text - original text.
 * @param from - inclusive start offset.
 * @param delimiters - the open and close delimiters to match.
 * @returns the first non-empty block, or undefined.
 */
function findQuote(text: string, from: number, delimiters: QuoteDelimiters): QuoteMatch | undefined {
  const pattern = new RegExp(
    `${escapeRegExp(delimiters.open)}([^\\r\\n]{1,${SOURCE_LINE_MAX}})\\r?\\n([\\s\\S]*?)\\r?\\n${escapeRegExp(delimiters.close)}`,
    'gu',
  )
  pattern.lastIndex = from
  for (let found = pattern.exec(text); found !== null; found = pattern.exec(text)) {
    // The pattern consumes the newline right before the close delimiter; a blank line
    // there leaves one more newline inside the captured body.
    const body = found[2].replace(/\r?\n$/, '')
    if (body.trim().length > 0) {
      return { start: found.index, end: found.index + found[0].length, body, role: roleOf(found[1]) }
    }
  }
  return undefined
}

/**
 * First quote block at or after `from` across every locale; the earlier block wins.
 *
 * @param text - original text.
 * @param from - inclusive start offset.
 * @returns the earliest match, or undefined.
 */
function firstQuote(text: string, from: number): QuoteMatch | undefined {
  let best: QuoteMatch | undefined
  for (const delimiters of quoteMessages()) {
    const found = findQuote(text, from, delimiters)
    if (found !== undefined && (best === undefined || found.start < best.start)) best = found
  }
  return best
}

/**
 * Parse the first quote block of a text. The chip reveal and the sent-message
 * card both read quotes through this function, so they agree on the body.
 *
 * @param text - text that may contain a quote block, e.g. a chip's padded model text.
 * @returns the body and role of the first non-empty block, or undefined when there is none.
 */
export function quoteBlockOf(text: string): { readonly body: string; readonly role?: QuoteRole } | undefined {
  const best = firstQuote(text, 0)
  return best === undefined ? undefined : { body: best.body, role: best.role }
}

/**
 * Quote-block rule. `order` only breaks ties between rules that start at the same
 * offset; quote blocks never overlap the plain-text fallback.
 */
export const quoteTextRule: UserTextRule<'selection-quote'> = {
  id: 'selection-quote',
  order: 5,
  match(text, from) {
    const best = firstQuote(text, from)
    if (best === undefined) return undefined
    return { id: 'selection-quote', start: best.start, end: best.end, data: { body: best.body, role: best.role } }
  },
}
