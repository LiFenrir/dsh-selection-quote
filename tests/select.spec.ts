// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { captureSelection, codeBlockOf, isAllowedContainer } from '../src/client/select'

const SESSION = 's1' as SessionId

const FIXTURE = `
<div class="composer" contenteditable="true"><p id="draft">草稿文字</p></div>
<div data-chat-node-key="n1" data-chat-flow-kind="assistant-step">
  <div class="md">
    <p id="p1">先给结论：把 O(n²) 改成 O(n log n)</p>
    <p id="p2">代价是多一倍内存。<button type="button">复制</button></p>
  </div>
</div>
<div data-chat-node-key="n2" data-chat-flow-kind="user">
  <p id="u1">另一条用户消息</p>
</div>
<div data-chat-node-key="n3" data-chat-flow-kind="context">
  <p id="c1">上下文噪声文字</p>
</div>
<div data-chat-node-key="n4" data-chat-flow-kind="assistant-step">
  <div class="md-code-block" id="block">
    <div data-code-block-banner id="banner"><div id="heading"><span id="lang">ts</span></div><div><button type="button">复制代码</button></div></div>
    <div data-code-block-content><pre class="shiki" id="pre"><code>const a = 1
const b = 2
</code></pre></div>
  </div>
</div>
`

function rectStub(): DOMRect {
  return { x: 20, y: 10, top: 10, left: 20, right: 120, bottom: 30, width: 100, height: 20, toJSON: () => ({}) }
}

function byId(id: string): HTMLElement {
  const el = document.getElementById(id)
  if (el === null) throw new Error(`fixture #${id} missing`)
  return el
}

function nodeOf(key: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(`[data-chat-node-key="${key}"]`)
  if (el === null) throw new Error(`node ${key} missing`)
  return el
}

function codeText(): Node {
  const text = byId('pre').querySelector('code')?.firstChild
  if (text === undefined || text === null) throw new Error('code text missing')
  return text
}

function selectRange(startNode: Node, startOffset: number, endNode: Node, endOffset: number): void {
  const range = document.createRange()
  range.setStart(startNode, startOffset)
  range.setEnd(endNode, endOffset)
  const selection = document.getSelection()
  if (selection === null) throw new Error('no selection API')
  selection.removeAllRanges()
  selection.addRange(range)
}

function selectNodeContents(el: Element): void {
  const range = document.createRange()
  range.selectNodeContents(el)
  const selection = document.getSelection()
  if (selection === null) throw new Error('no selection API')
  selection.removeAllRanges()
  selection.addRange(range)
}

beforeAll(() => {
  // jsdom has no layout; the rect only needs to be a DOMRect-shaped value.
  Range.prototype.getBoundingClientRect = rectStub
})

beforeEach(() => {
  document.body.innerHTML = FIXTURE
  document.getSelection()?.removeAllRanges()
})

describe('captureSelection', () => {
  it('captures a full assistant paragraph with its node key', () => {
    selectNodeContents(byId('p1'))
    const result = captureSelection(document, SESSION)
    expect(result.kind).toBe('selection')
    if (result.kind !== 'selection') return
    expect(result.selection.text).toBe('先给结论：把 O(n²) 改成 O(n log n)')
    expect(result.selection.flowKind).toBe('assistant-step')
    expect(result.selection.nodeKey).toBe('n1')
    expect(result.selection.anchor).toBe(byId('p1').closest('[data-chat-node-key]'))
    expect(result.selection.sessionId).toBe(SESSION)
    expect(result.selection.code).toBeUndefined()
    expect(result.selection.rect).toEqual({ top: 10, left: 20, right: 120, bottom: 30, width: 100, height: 20 })
  })

  it('ignores a selection that starts in the composer', () => {
    selectRange(byId('draft').firstChild as Node, 0, byId('p1').firstChild as Node, 3)
    expect(captureSelection(document, SESSION)).toEqual({ kind: 'none' })
  })

  it('ignores a selection that ends inside a control', () => {
    const button = document.querySelector('button')
    if (button === null) throw new Error('button fixture missing')
    selectRange(byId('p2').firstChild as Node, 0, button.firstChild as Node, 2)
    expect(captureSelection(document, SESSION)).toEqual({ kind: 'none' })
  })

  it('reports a selection spanning two messages as cross-node', () => {
    selectRange(byId('p1').firstChild as Node, 0, byId('u1').firstChild as Node, 2)
    const result = captureSelection(document, SESSION)
    expect(result.kind).toBe('cross-node')
  })

  it('ignores a message kind that is not quotable', () => {
    selectNodeContents(byId('c1'))
    expect(captureSelection(document, SESSION)).toEqual({ kind: 'none' })
  })

  it('ignores a collapsed selection', () => {
    selectRange(byId('p1').firstChild as Node, 1, byId('p1').firstChild as Node, 1)
    expect(captureSelection(document, SESSION)).toEqual({ kind: 'none' })
  })

  it('ignores a selection with fewer than two visible characters', () => {
    selectRange(byId('p1').firstChild as Node, 0, byId('p1').firstChild as Node, 1)
    expect(captureSelection(document, SESSION)).toEqual({ kind: 'none' })
  })

  it('drops button labels from the extracted text', () => {
    selectNodeContents(byId('p2'))
    const result = captureSelection(document, SESSION)
    expect(result.kind === 'selection' && result.selection.text).toBe('代价是多一倍内存。')
  })

  it('drops banner chrome when a whole code block is selected', () => {
    selectNodeContents(nodeOf('n4'))
    const result = captureSelection(document, SESSION)
    expect(result.kind).toBe('selection')
    if (result.kind !== 'selection') return
    expect(result.selection.text).not.toContain('复制代码')
    expect(result.selection.text).not.toContain('ts\n')
  })

  it('fences a fully covered code block with its language', () => {
    selectNodeContents(byId('block'))
    const result = captureSelection(document, SESSION)
    expect(result.kind).toBe('selection')
    if (result.kind !== 'selection') return
    expect(result.selection.code).toEqual({ lang: 'ts', text: 'const a = 1\nconst b = 2' })
    expect(result.selection.text).toBe('const a = 1\nconst b = 2')
  })

  it('quotes a partial code selection as plain text', () => {
    selectRange(codeText(), 0, codeText(), 7)
    const result = captureSelection(document, SESSION)
    expect(result.kind).toBe('selection')
    if (result.kind !== 'selection') return
    expect(result.selection.code).toBeUndefined()
    expect(result.selection.text).toBe('const a')
  })
})

describe('codeBlockOf', () => {
  it('returns the block and pre when the range covers the code', () => {
    const range = document.createRange()
    range.selectNodeContents(byId('block'))
    const found = codeBlockOf(range)
    expect(found?.block).toBe(byId('block'))
    expect(found?.pre).toBe(byId('pre'))
  })

  it('returns undefined for a range outside any code block', () => {
    const range = document.createRange()
    range.selectNodeContents(byId('p1'))
    expect(codeBlockOf(range)).toBeUndefined()
  })
})

describe('isAllowedContainer', () => {
  it('rejects null', () => {
    expect(isAllowedContainer(null)).toBe(false)
  })

  it('accepts a message paragraph', () => {
    expect(isAllowedContainer(byId('p1'))).toBe(true)
  })

  it('rejects the composer', () => {
    expect(isAllowedContainer(byId('draft'))).toBe(false)
  })
})
