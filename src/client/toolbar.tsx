/**
 * Root-scoped toolbar in `shell.overlay`. It sits above the selection, owns
 * focus-safe pointer handling and dismissal, and delegates the insertion to the
 * session that owns the selection.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-store'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ApplyOutcome, DockSnapshot, QuoteRect } from './dock'

/** Gap between the selection and the toolbar, in px. */
export const TOOLBAR_GAP = 8
/** Minimum distance from the viewport edge, in px. */
export const VIEWPORT_MARGIN = 8

/** Props for {@link QuoteToolbar}: the root hook, the inject face, and the locale. */
export interface QuoteToolbarProps {
  useSelectionQuote: SnapshotSelectorHook<DockSnapshot>
  /** Insert the quote for `sessionId`; `locked` means the composer was busy and nothing changed. */
  applyQuote: (sessionId: SessionId) => ApplyOutcome | 'locked'
  dismiss: () => void
  t: TranslateNS<'selectionQuote'>
}

/**
 * Compute the fixed-position box for the toolbar. It is placed above the
 * selection and flips below when there is no room above. The horizontal
 * position is clamped to the viewport.
 *
 * @param rect - selection box in viewport coordinates.
 * @param size - measured toolbar size in px.
 * @param viewport - viewport size in px.
 * @returns `top` and `left` in px for `position: fixed`.
 */
export function placeToolbar(
  rect: QuoteRect,
  size: { width: number; height: number },
  viewport: { width: number; height: number },
): { top: number; left: number } {
  let top = rect.top - TOOLBAR_GAP - size.height
  if (top < VIEWPORT_MARGIN) top = rect.bottom + TOOLBAR_GAP
  const centered = rect.left + rect.width / 2 - size.width / 2
  const maxLeft = viewport.width - size.width - VIEWPORT_MARGIN
  return { top, left: Math.max(VIEWPORT_MARGIN, Math.min(centered, maxLeft)) }
}

/**
 * Render the quote toolbar for the current dock state.
 *
 * The toolbar is hidden until its first measurement, so it never paints at the
 * wrong position. Pointer-down on the toolbar is cancelled so the browser keeps
 * the selection. Outside pointer-down, Escape, scroll and resize dismiss it.
 *
 * @param props - dock hook, inject face, and the locale `t`.
 * @returns `null` when idle; otherwise the action toolbar or the cross-message hint.
 */
export function QuoteToolbar({ useSelectionQuote, applyQuote, dismiss, t }: QuoteToolbarProps) {
  const snapshot = useSelectionQuote(s => s)
  const ref = useRef<HTMLDivElement>(null)
  const [placed, setPlaced] = useState<{ top: number; left: number }>()
  const rect = snapshot.phase === 'idle'
    ? undefined
    : snapshot.phase === 'blocked' ? snapshot.rect : snapshot.selection.rect
  const active = rect !== undefined

  useLayoutEffect(() => {
    const el = ref.current
    if (rect === undefined || el === null) {
      setPlaced(undefined)
      return
    }
    const box = el.getBoundingClientRect()
    setPlaced(placeToolbar(rect, { width: box.width, height: box.height }, { width: window.innerWidth, height: window.innerHeight }))
  }, [rect])

  useEffect(() => {
    if (!active) return
    const onPointerDown = (event: PointerEvent): void => {
      if (event.target instanceof Node && ref.current?.contains(event.target)) return
      dismiss()
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') dismiss()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', dismiss, true)
    window.addEventListener('resize', dismiss)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', dismiss, true)
      window.removeEventListener('resize', dismiss)
    }
  }, [active, dismiss])

  if (snapshot.phase === 'idle') return null
  const blocked = snapshot.phase === 'blocked'
  const style = {
    top: placed?.top ?? 0,
    left: placed?.left ?? 0,
    visibility: placed === undefined ? 'hidden' as const : undefined,
  }

  return (
    <>
      <style>{QUOTE_CSS}</style>
      <div
        ref={ref}
        className="dsh-quote-toolbar"
        role={blocked ? 'status' : 'toolbar'}
        aria-label={blocked ? undefined : t('toolbar.label')}
        style={style}
        onPointerDown={event => { event.preventDefault() }}
        onMouseDown={event => { event.preventDefault() }}
        onKeyDown={event => { if (event.key === 'Escape') dismiss() }}
      >
        {blocked
          ? <span className="dsh-quote-hint">{t('hint.crossNode')}</span>
          : (
            <>
              <button type="button" className="dsh-quote-btn" onClick={() => { applyQuote(snapshot.selection.sessionId) }}>
                {t('action.quote')}
              </button>
              <button type="button" className="dsh-quote-close" aria-label={t('action.close')} onClick={dismiss}>
                ×
              </button>
            </>
          )}
      </div>
    </>
  )
}

/**
 * Component-local stylesheet. Only theme tokens are referenced, so light and
 * dark themes are both covered. Motion falls back to opacity under
 * `prefers-reduced-motion`.
 */
const QUOTE_CSS = `
.dsh-quote-toolbar {
  position: fixed;
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  border-radius: var(--dsw-radius-md);
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
  box-shadow: var(--dsw-elevation-prominent);
  animation: dsh-quote-in 120ms ease-out;
}
.dsh-quote-btn,
.dsh-quote-close {
  font: inherit;
  font-size: 13px;
  line-height: 1;
  color: var(--dsw-alias-label-primary);
  background: transparent;
  border: 0;
  border-radius: var(--dsw-radius-sm);
  padding: 6px 10px;
  cursor: pointer;
}
.dsh-quote-close {
  color: var(--dsw-alias-label-secondary);
  padding: 6px 8px;
}
.dsh-quote-btn:hover,
.dsh-quote-close:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}
.dsh-quote-btn:active,
.dsh-quote-close:active {
  opacity: 0.7;
}
.dsh-quote-btn:focus-visible,
.dsh-quote-close:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary);
  outline-offset: 1px;
}
.dsh-quote-hint {
  font-size: 12px;
  color: var(--dsw-alias-label-secondary);
  padding: 6px 10px;
}
@keyframes dsh-quote-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  .dsh-quote-toolbar {
    animation: dsh-quote-fade 120ms ease-out;
  }
}
@keyframes dsh-quote-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
`
