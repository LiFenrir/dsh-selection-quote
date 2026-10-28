// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { quoteTargetOf, selectionCovers } from '../src/client/quote-target'

/** Markup the official message-quotes renderer produces for one sent quote. */
function quote(text: string, key = 'node-1') {
  const message = document.createElement('div')
  message.setAttribute('data-chat-node-key', key)
  const preview = document.createElement('span')
  preview.setAttribute('data-quote-preview', '')
  const body = document.createElement('span')
  body.setAttribute('data-quote-preview-text', '')
  body.textContent = text
  preview.append(body)
  message.append(preview)
  document.body.append(message)
  return { message, preview, body }
}

afterEach(() => {
  window.getSelection()?.removeAllRanges()
  document.body.replaceChildren()
})

describe('quoteTargetOf', () => {
  it('resolves the preview, its full text and the message holding it', () => {
    const { message, preview, body } = quote('先给结论\n第二行')
    const target = quoteTargetOf(body)
    expect(target?.preview).toBe(preview)
    expect(target?.text).toBe('先给结论\n第二行')
    expect(target?.before).toBe(message)
  })

  it('resolves a click on the preview root itself', () => {
    const { message, preview } = quote('先给结论')
    const target = quoteTargetOf(preview)
    expect(target?.preview).toBe(preview)
    expect(target?.text).toBe('先给结论')
    expect(target?.before).toBe(message)
  })

  it('ignores a quote inside the composer', () => {
    const composer = document.createElement('div')
    composer.setAttribute('contenteditable', 'true')
    const message = document.createElement('div')
    message.setAttribute('data-chat-node-key', 'node-1')
    const preview = document.createElement('span')
    preview.setAttribute('data-quote-preview', '')
    const body = document.createElement('span')
    body.setAttribute('data-quote-preview-text', '')
    body.textContent = '草稿里的引用'
    preview.append(body)
    message.append(preview)
    composer.append(message)
    document.body.append(composer)
    expect(quoteTargetOf(body)).toBeNull()
  })

  it('ignores a quote outside a chat message', () => {
    const preview = document.createElement('span')
    preview.setAttribute('data-quote-preview', '')
    const body = document.createElement('span')
    body.setAttribute('data-quote-preview-text', '')
    body.textContent = '孤立引用'
    preview.append(body)
    document.body.append(preview)
    expect(quoteTargetOf(body)).toBeNull()
  })

  it('ignores a preview without quoted text', () => {
    const { body } = quote('   ')
    expect(quoteTargetOf(body)).toBeNull()
  })

  it('ignores targets that are not elements', () => {
    expect(quoteTargetOf(null)).toBeNull()
    expect(quoteTargetOf(document.createTextNode('文字'))).toBeNull()
    expect(quoteTargetOf(document)).toBeNull()
  })
})

describe('selectionCovers', () => {
  it('is false without a selection', () => {
    const el = document.createElement('div')
    document.body.append(el)
    expect(selectionCovers(el)).toBe(false)
  })

  it('is false for a collapsed selection', () => {
    const el = document.createElement('div')
    el.textContent = '先给结论'
    document.body.append(el)
    const range = document.createRange()
    range.setStart(el.firstChild as Text, 0)
    range.collapse(true)
    window.getSelection()?.addRange(range)
    expect(selectionCovers(el)).toBe(false)
  })

  it('is true when the selection intersects the element', () => {
    const el = document.createElement('div')
    el.textContent = '先给结论'
    document.body.append(el)
    const range = document.createRange()
    range.selectNodeContents(el)
    window.getSelection()?.addRange(range)
    expect(selectionCovers(el)).toBe(true)
  })

  it('is false when the selection stays outside the element', () => {
    const el = document.createElement('div')
    el.textContent = '先给结论'
    const other = document.createElement('div')
    other.textContent = '别处'
    document.body.append(el, other)
    const range = document.createRange()
    range.selectNodeContents(other)
    window.getSelection()?.addRange(range)
    expect(selectionCovers(el)).toBe(false)
  })
})
