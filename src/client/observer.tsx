/**
 * Session-scoped observer. It watches the document selection, serializes the
 * quotable part into the dock, and offers it to the toolbar together with the
 * composer position captured at click time. It renders nothing.
 */
import { useEffect, useRef } from 'react'
import type { UseSession } from '@deepseek-ai/dsh-client-ui-session/client'
import type { SessionStandardProps, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { BoundQuote, Dock, QuoteOffer, QuotePayload } from './dock'
import { captureSelection } from './select'
import { chipLabel } from './reference'
import {
  composeSourceLabel,
  formatQuoteBody,
  quoteBlock,
  roleLabel,
  type QuoteMessages,
} from './format'

/** Debounce after the last selection change, so a drag does not flicker the toolbar. */
const COMMIT_DELAY_MS = 150
/** How long the cross-message hint stays up. */
const BLOCK_HINT_MS = 1500

/** Props this observer receives: standard session props plus the inject face. */
export interface ObserverProps extends SessionStandardProps {
  useSession: UseSession
  t: TranslateNS<'selectionQuote'>
  dock: Dock
  bind: (bound: BoundQuote) => void
  unbind: (sessionId: SessionId) => void
}

/** The selection the dock currently offers, kept in the effect closure. */
interface Pending {
  payload: QuotePayload
  anchor: Element
  /** `Selection.toString()` at capture time, compared on later selection changes. */
  selectionText: string
}

/**
 * Observe the document selection for the mounted session. The effect is keyed
 * by session id, so switching sessions hides the dock and unbinds the old one.
 *
 * @param props - session standard props, the locale `t`, and the inject face.
 * @returns `null`; the observer only drives the dock.
 */
export function SelectionObserver(props: ObserverProps): null {
  const { useSession, inputActions, t, dock, bind, unbind } = props
  const sessionId = useSession(s => s.sessionId)
  // The offer reads the locale through a ref so it stays valid across re-renders without re-binding.
  const tRef = useRef(t)
  tRef.current = t

  useEffect(() => {
    let pending: Pending | undefined
    let lastApplied: string | undefined
    let composing = false
    let frame = 0
    let commitTimer: ReturnType<typeof setTimeout> | undefined
    let blockTimer: ReturnType<typeof setTimeout> | undefined

    const evaluate = (): void => {
      if (composing) return
      const result = captureSelection(document, sessionId)
      if (result.kind === 'none') {
        pending = undefined
        lastApplied = undefined
        dock.hide()
        return
      }
      if (result.kind === 'cross-node') {
        pending = undefined
        dock.block('cross-node', result.rect)
        clearTimeout(blockTimer)
        blockTimer = setTimeout(() => {
          if (dock.getSnapshot().phase === 'blocked') dock.hide()
        }, BLOCK_HINT_MS)
        return
      }
      const { selection } = result
      const selectionText = document.getSelection()?.toString() ?? ''
      if (selectionText === lastApplied) {
        dock.hide()
        return
      }
      const messages = buildMessages(tRef.current)
      const sourceLabel = composeSourceLabel(selection.flowKind, messages)
      const body = formatQuoteBody({
        raw: selection.text,
        flowKind: selection.flowKind,
        code: selection.code,
        messages,
      })
      const payload: QuotePayload = {
        modelText: quoteBlock(body, sourceLabel, messages),
        label: chipLabel(tRef.current('chip.label'), roleLabel(selection.flowKind, messages), body),
        nodeKey: selection.nodeKey,
        flowKind: selection.flowKind,
      }
      pending = { payload, anchor: selection.anchor, selectionText }
      dock.show({
        text: body,
        sourceLabel,
        nodeKey: selection.nodeKey,
        flowKind: selection.flowKind,
        rect: selection.rect,
        sessionId,
        capturedAt: Date.now(),
      })
    }

    const schedule = (): void => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        clearTimeout(commitTimer)
        commitTimer = setTimeout(evaluate, COMMIT_DELAY_MS)
      })
    }

    // Called from the toolbar click; the caller captures the insertion point
    // and inserts within the same task, so the caret cannot move in between.
    const offer = (): QuoteOffer | undefined => {
      const current = pending
      if (current === undefined) return undefined
      return {
        payload: current.payload,
        isAnchored: () => current.anchor.isConnected,
        captureInsertion: () => inputActions.captureInsertion(),
        markApplied: () => {
          lastApplied = current.selectionText
          pending = undefined
        },
      }
    }

    const hide = (): void => { dock.hide() }

    const onPointerUp = (event: PointerEvent): void => {
      if (event.button !== 0) return
      // Clicks on the toolbar itself must not re-offer the quote they just used.
      if (event.target instanceof Element && event.target.closest('.dsh-quote-toolbar') !== null) return
      schedule()
    }
    const onSelectionChange = (): void => {
      const current = document.getSelection()
      if (dock.getSnapshot().phase === 'visible' && (current === null || current.toString() !== pending?.selectionText)) {
        dock.hide()
      }
      schedule()
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') dock.hide()
    }
    const onCompositionStart = (): void => { composing = true }
    const onCompositionEnd = (): void => {
      composing = false
      schedule()
    }

    bind({ sessionId, offer })
    document.addEventListener('pointerup', onPointerUp)
    document.addEventListener('selectionchange', onSelectionChange)
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('compositionstart', onCompositionStart)
    document.addEventListener('compositionend', onCompositionEnd)
    window.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)
    return () => {
      document.removeEventListener('pointerup', onPointerUp)
      document.removeEventListener('selectionchange', onSelectionChange)
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('compositionstart', onCompositionStart)
      document.removeEventListener('compositionend', onCompositionEnd)
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
      cancelAnimationFrame(frame)
      clearTimeout(commitTimer)
      clearTimeout(blockTimer)
      unbind(sessionId)
      dock.hide()
    }
  }, [sessionId, inputActions, dock, bind, unbind])

  return null
}

/**
 * Snapshot the locale strings that the serializer needs. Templates keep their
 * `{name}` placeholders; the pure functions fill them.
 *
 * @param t - namespace-bound translate function.
 * @returns the message bundle for {@link formatQuoteBody} and {@link quoteBlock}.
 */
function buildMessages(t: TranslateNS<'selectionQuote'>): QuoteMessages {
  return {
    open: t('format.open'),
    close: t('format.close'),
    escapeOpen: t('format.escapeOpen'),
    escapeClose: t('format.escapeClose'),
    user: t('source.user'),
    assistant: t('source.assistant'),
    truncated: t('format.truncated'),
  }
}
