import { describe, expect, it } from 'vitest'
import {
  QUOTE_SOURCE,
  buildQuoteReference,
  chipLabel,
  decodeQuoteRef,
  encodeQuoteRef,
  quoteCodec,
} from '../src/client/reference'
import { zh } from '../src/client/locales'

const SAMPLE = '【引用】助手回复\n先给结论：把 O(n²) 改成 O(n log n) 😀\n【/引用】'
const PADDED = `\n\n${SAMPLE}\n\n`
const SOURCE = { nodeKey: 'turn-3/node-7', flowKind: 'assistant-step' as const }

/** base64url of the UTF-8 bytes, built with the same browser APIs the codec uses. */
function base64UrlOf(text: string): string {
  const binary = String.fromCharCode(...new TextEncoder().encode(text))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Encode an arbitrary JSON value as a `sq2.` ref, to build malformed payloads. */
function rawV2(value: unknown): string {
  return `sq2.${base64UrlOf(JSON.stringify(value))}`
}

describe('encodeQuoteRef / decodeQuoteRef', () => {
  it('round-trips Chinese text, emoji, node key and flow kind', () => {
    const ref = { text: PADDED, ...SOURCE }
    expect(decodeQuoteRef(encodeQuoteRef(ref))).toEqual(ref)
  })

  it('round-trips a body longer than one binary chunk', () => {
    const long = '甲😀'.repeat(4000)
    expect(decodeQuoteRef(encodeQuoteRef({ text: long, ...SOURCE })).text).toBe(long)
  })

  it('round-trips the empty text and an empty node key', () => {
    const ref = { text: '', nodeKey: '', flowKind: 'user' as const }
    expect(decodeQuoteRef(encodeQuoteRef(ref))).toEqual(ref)
  })

  it('keeps each flow kind as written', () => {
    for (const flowKind of ['user', 'steering', 'assistant-step'] as const) {
      expect(decodeQuoteRef(encodeQuoteRef({ text: 'x', nodeKey: 'n', flowKind }))).toEqual({ text: 'x', nodeKey: 'n', flowKind })
    }
  })

  it('emits only URL-safe characters after the prefix', () => {
    const ref = encodeQuoteRef({ text: '>?>???', nodeKey: '>?>???', flowKind: 'user' })
    expect(ref.startsWith('sq2.')).toBe(true)
    expect(ref.slice('sq2.'.length)).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('decodes a legacy sq1 ref to its text alone', () => {
    const legacy = `sq1.${base64UrlOf(SAMPLE)}`
    expect(decodeQuoteRef(legacy)).toEqual({ text: SAMPLE })
  })

  it('rejects a ref without a known version prefix', () => {
    expect(() => decodeQuoteRef('xx1.aGk')).toThrow('unknown format')
  })

  it('rejects malformed base64', () => {
    expect(() => decodeQuoteRef('sq2.a')).toThrow()
    expect(() => decodeQuoteRef('sq1.a')).toThrow()
  })

  it('rejects bytes that are not valid UTF-8', () => {
    // 0xFF is never valid UTF-8; base64url of that single byte is `_w`.
    expect(() => decodeQuoteRef('sq1._w')).toThrow()
  })

  it('rejects a v2 payload that is not JSON', () => {
    const notJson = `sq2.${base64UrlOf('not json')}`
    expect(() => decodeQuoteRef(notJson)).toThrow()
  })

  it('rejects a v2 payload with a missing field or an unknown flow kind', () => {
    expect(() => decodeQuoteRef(rawV2({ text: 'x', nodeKey: 'n' }))).toThrow('malformed')
    expect(() => decodeQuoteRef(rawV2({ text: 'x', nodeKey: 'n', flowKind: 'tool-call' }))).toThrow('malformed')
  })
})

describe('chipLabel', () => {
  const template = zh['chip.label']

  it('fills role and a short single-line preview without an ellipsis', () => {
    expect(chipLabel(template, '助手回复', '先给结论')).toBe('引用 · 助手回复 · 先给结论')
  })

  it('keeps a line of exactly 20 code points without an ellipsis', () => {
    expect(chipLabel(template, '用户消息', '甲'.repeat(20))).toBe(`引用 · 用户消息 · ${'甲'.repeat(20)}`)
  })

  it('cuts a longer line to 20 code points with an ellipsis', () => {
    expect(chipLabel(template, '用户消息', '甲'.repeat(25))).toBe(`引用 · 用户消息 · ${'甲'.repeat(20)}…`)
  })

  it('does not split an emoji at the cut', () => {
    expect(chipLabel(template, '助手回复', '😀'.repeat(21))).toBe(`引用 · 助手回复 · ${'😀'.repeat(20)}…`)
  })

  it('uses only the first line of a multi-line body and adds an ellipsis', () => {
    expect(chipLabel(template, '助手回复', 'first\nsecond')).toBe('引用 · 助手回复 · first…')
  })

  it('skips a code fence and previews the first code line', () => {
    expect(chipLabel(template, '助手回复', '```ts\nconst a = 1\n```')).toBe('引用 · 助手回复 · const a = 1…')
  })

  it('skips blank lines before the preview', () => {
    expect(chipLabel(template, '助手回复', '\n  \n正文')).toBe('引用 · 助手回复 · 正文…')
  })

  it('falls back to the first line when every line is a fence', () => {
    expect(chipLabel(template, '助手回复', '```')).toBe('引用 · 助手回复 · ```')
  })

  it('contains no turn number', () => {
    expect(chipLabel(template, '助手回复', '正文')).not.toMatch(/第 \d+ 轮/)
  })
})

describe('buildQuoteReference', () => {
  it('builds a session-appearance chip whose clipboard text is the padded model text', () => {
    const reference = buildQuoteReference({ modelText: SAMPLE, label: '引用 · 助手回复 · 先给结论', ...SOURCE })
    expect(reference).toEqual({
      source: QUOTE_SOURCE,
      ref: encodeQuoteRef({ text: PADDED, ...SOURCE }),
      label: '引用 · 助手回复 · 先给结论',
      appearance: 'session',
      clipboardText: PADDED,
    })
  })

  it('carries the source of the quoted message inside the ref', () => {
    const reference = buildQuoteReference({ modelText: SAMPLE, label: 'label', ...SOURCE })
    expect(decodeQuoteRef(reference.ref)).toEqual({ text: PADDED, ...SOURCE })
  })

  it('stores a ref that the codec serializes back to the padded model text', async () => {
    const reference = buildQuoteReference({ modelText: SAMPLE, label: 'label', ...SOURCE })
    await expect(quoteCodec.serialize(reference.ref, new AbortController().signal)).resolves.toBe(PADDED)
  })

  it('keeps the codec clipboard projection equal to the padded text', () => {
    const reference = buildQuoteReference({ modelText: SAMPLE, label: 'label', ...SOURCE })
    expect(quoteCodec.clipboardText(reference.ref)).toBe(reference.clipboardText)
  })

  it('rejects serialization of a corrupted ref instead of returning a fallback', async () => {
    await expect(quoteCodec.serialize('broken', new AbortController().signal)).rejects.toThrow()
  })
})
