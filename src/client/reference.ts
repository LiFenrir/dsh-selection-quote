/**
 * Composer chip for one quoted selection. The chip stores the model text and
 * the source message in its `ref`, so the submit path can rebuild the exact
 * block the model receives and the chip can scroll back to its source, even
 * after the draft is persisted or restored.
 */
import type { ReferenceCodec, ReferenceInsert } from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import { FLOW_KINDS, type FlowKind } from './format'

/**
 * Stable source id. Persisted chips route their codec through it, so renaming
 * it would orphan every chip already saved in a draft.
 */
export const QUOTE_SOURCE = 'quote'

/**
 * The source contract requires a trigger char. `@` is never opened by this
 * source: it has no menu candidates and no pick path.
 */
export const QUOTE_TRIGGER = '@'

/**
 * Version prefix of the current `ref`: base64url of a JSON payload. A new
 * encoding must change it so unknown refs fail loudly.
 */
const REF_PREFIX = 'sq2.'
/**
 * Version prefix of the legacy `ref`, which holds only the padded model text.
 * Still decoded so drafts saved before the source fields existed keep sending.
 */
const LEGACY_REF_PREFIX = 'sq1.'
/** Preview length of the chip label, in code points. */
const PREVIEW_CODE_POINTS = 20
/** A fence line such as ```` ```ts ````; it names the language, so it is never the preview. */
const FENCE_LINE = /^`{3,}/
/**
 * Bytes per `String.fromCharCode` call. Spreading a long buffer into one call
 * exceeds the engine's argument limit for quotes near the 4000-code-point cap.
 */
const BINARY_CHUNK = 0x8000

/** Decoded `ref`. Legacy refs carry no source, so `nodeKey` and `flowKind` are absent. */
export interface QuoteRef {
  /** Padded model text: the exact text the model receives for this quote. */
  text: string
  /** `data-chat-node-key` of the quoted message. */
  nodeKey?: string
  /** `data-chat-flow-kind` of the quoted message. */
  flowKind?: FlowKind
}

/**
 * Base64url of the UTF-8 bytes, unpadded. `+` and `/` are replaced so the
 * result stays valid inside a URL and a draft without escaping.
 *
 * @param text - text to encode.
 * @returns base64url string without `=` padding.
 */
function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (let i = 0; i < bytes.length; i += BINARY_CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + BINARY_CHUNK))
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Inverse of {@link toBase64Url}.
 *
 * @param body - base64url string without padding.
 * @returns the decoded UTF-8 text.
 * @throws {Error} when the base64 is malformed or the bytes are not UTF-8.
 */
function fromBase64Url(body: string): string {
  const base64 = body.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  // atob throws on malformed base64; fatal TextDecoder rejects bytes that are not UTF-8.
  const bytes = Uint8Array.from(atob(padded), char => char.charCodeAt(0))
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}

/**
 * Check that a parsed v2 payload has the shape {@link encodeQuoteRef} writes.
 *
 * @param value - JSON value parsed from a `sq2.` ref.
 * @returns `true` when `text`, `nodeKey` and `flowKind` have the expected types.
 */
function isQuoteRef(value: unknown): value is Required<QuoteRef> {
  return typeof value === 'object' && value !== null
    && 'text' in value && typeof value.text === 'string'
    && 'nodeKey' in value && typeof value.nodeKey === 'string'
    && 'flowKind' in value && typeof value.flowKind === 'string'
    && (FLOW_KINDS as readonly string[]).includes(value.flowKind)
}

/**
 * Encode a quote as a `ref`.
 *
 * @param ref - padded model text, source node key and flow kind.
 * @returns `sq2.` followed by unpadded base64url of the JSON payload.
 */
export function encodeQuoteRef(ref: Required<QuoteRef>): string {
  return REF_PREFIX + toBase64Url(JSON.stringify(ref))
}

/**
 * Decode a `ref` produced by {@link encodeQuoteRef}, or a legacy `sq1.` ref.
 *
 * Throws instead of returning a fallback: a quote that cannot be decoded must
 * fail the send, never be silently dropped from the prompt.
 *
 * @param ref - chip reference as stored in the draft.
 * @returns the model text, plus the source when the ref is v2.
 * @throws {Error} when the prefix is unknown, the base64 or JSON is malformed, or the bytes are not UTF-8.
 */
export function decodeQuoteRef(ref: string): QuoteRef {
  if (ref.startsWith(LEGACY_REF_PREFIX)) return { text: fromBase64Url(ref.slice(LEGACY_REF_PREFIX.length)) }
  if (!ref.startsWith(REF_PREFIX)) throw new Error('quote reference has an unknown format')
  const payload: unknown = JSON.parse(fromBase64Url(ref.slice(REF_PREFIX.length)))
  if (!isQuoteRef(payload)) throw new Error('quote reference payload is malformed')
  return payload
}

/**
 * Build the chip label: role plus a short preview of the quote.
 *
 * The preview is the first non-empty line that is not a code fence, so a code
 * block shows its code instead of the language line. An ellipsis marks a cut
 * preview: the line is longer than the limit, or the body has more lines.
 *
 * @param template - localized template with `{role}` and `{preview}` placeholders.
 * @param role - localized role of the quoted message.
 * @param body - formatted quote body, fences included.
 * @returns the label shown inside the composer chip.
 */
export function chipLabel(template: string, role: string, body: string): string {
  const lines = body.split('\n')
  const line = lines.find(item => item.trim() !== '' && !FENCE_LINE.test(item)) ?? lines[0]
  const chars = Array.from(line)
  const cut = chars.length > PREVIEW_CODE_POINTS || lines.length > 1
  const preview = chars.slice(0, PREVIEW_CODE_POINTS).join('') + (cut ? '…' : '')
  return template.split('{role}').join(role).split('{preview}').join(preview)
}

/** Input for {@link buildQuoteReference}. */
export interface QuoteReferenceInput {
  /** Text the model receives for this quote, delimiters included, without the separating blank lines. */
  readonly modelText: string
  /** Chip label from {@link chipLabel}. */
  readonly label: string
  /** `data-chat-node-key` of the quoted message; empty when the DOM carries none. */
  readonly nodeKey: string
  readonly flowKind: FlowKind
}

/**
 * Build the reference that the conversation input inserts as one chip.
 *
 * The quote is padded with one blank line on each side, so the delimiters stay
 * apart from text typed before or after the chip. The padded text goes into both
 * `ref` and `clipboardText`, so the codec and the clipboard agree on it.
 *
 * `appearance` is `session` because the closed union only offers the existing
 * session/file/folder glyphs, and "quoted from a message" is closest to the
 * session glyph.
 *
 * @param input - model text, chip label, and the source message.
 * @returns the insert payload for `slash/input-insert-reference`.
 */
export function buildQuoteReference(input: QuoteReferenceInput): ReferenceInsert {
  const padded = `\n\n${input.modelText}\n\n`
  return {
    source: QUOTE_SOURCE,
    ref: encodeQuoteRef({ text: padded, nodeKey: input.nodeKey, flowKind: input.flowKind }),
    label: input.label,
    appearance: 'session',
    clipboardText: padded,
  }
}

/**
 * Codec for the quote source. Both projections decode the `ref`, so the
 * clipboard and the prompt receive the padded text captured at quote time.
 */
export const quoteCodec: ReferenceCodec = {
  clipboardText: ref => decodeQuoteRef(ref).text,
  serialize: async ref => decodeQuoteRef(ref).text,
}
