/**
 * Cross-scope selection state. The observer writes it from a session scope and
 * the toolbar reads it from the root scope, so it must be a plain observable
 * rather than a store seat: `store` pulls in a Harness client package at runtime.
 */
import type { TokenSpan } from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { FlowKind } from './format'

/** Viewport-relative box of a selection, from `DOMRect` with the fields we need. */
export interface QuoteRect {
  top: number
  left: number
  right: number
  bottom: number
  width: number
  height: number
}

/** A selection ready to quote. `text` and `sourceLabel` are already localized and serialized. */
export interface QuoteSelection {
  /** Serialized body, without the open and close delimiters. */
  text: string
  /** Localized source line, e.g. `助手回复`. */
  sourceLabel: string
  nodeKey: string
  flowKind: FlowKind
  rect: QuoteRect
  sessionId: SessionId
  capturedAt: number
}

/** Dock state. `blocked` shows a hint only and never carries a quote. */
export type DockSnapshot =
  | { phase: 'idle' }
  | { phase: 'visible'; selection: QuoteSelection }
  | { phase: 'blocked'; reason: 'cross-node'; rect: QuoteRect }

/** Observable dock: the observer and the root toolbar share one instance. */
export type Dock = HostObservable<DockSnapshot> & {
  show(selection: QuoteSelection): void
  block(reason: 'cross-node', rect: QuoteRect): void
  hide(): void
}

/** Result of inserting a quote into the composer. */
export type ApplyOutcome = 'inserted' | 'stale' | 'failed'

/** What the composer receives for one quote: the chip's model text, its label, and its source message. */
export interface QuotePayload {
  modelText: string
  label: string
  nodeKey: string
  flowKind: FlowKind
}

/**
 * The selection offered at click time. Methods are read through the observer's
 * closure, so they see the current selection rather than a snapshot copy.
 */
export interface QuoteOffer {
  readonly payload: QuotePayload
  /** False once the selection's anchor left the DOM; a stale quote must not be inserted. */
  isAnchored(): boolean
  captureInsertion(): TokenSpan
  /** Clears the offer and remembers it, so the same selection is not offered again. */
  markApplied(): void
}

/**
 * Observer-side handle for the selection currently offered to the composer.
 * It is held in the plugin closure, never in the snapshot, because it refers
 * to a DOM node and to the session's input actions.
 */
export interface BoundQuote {
  sessionId: SessionId
  /** The offer for the current selection, or undefined when nothing is offered. */
  offer(): QuoteOffer | undefined
}

const IDLE: DockSnapshot = { phase: 'idle' }

/**
 * Create the dock. Each publish replaces the snapshot object, so selectors
 * comparing by reference re-render on every change. `hide()` on an idle dock
 * is a no-op and does not notify.
 *
 * @returns an observable with `show`, `block` and `hide` writers.
 */
export function createDock(): Dock {
  let snapshot: DockSnapshot = IDLE
  const listeners = new Set<() => void>()
  const publish = (next: DockSnapshot): void => {
    snapshot = next
    for (const listener of listeners) listener()
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    show(selection) { publish({ phase: 'visible', selection }) },
    block(reason, rect) { publish({ phase: 'blocked', reason, rect }) },
    hide() {
      if (snapshot.phase === 'idle') return
      publish(IDLE)
    },
  }
}
