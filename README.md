# DSH Selection Quote

[中文](README.zh.md)

Select text in a conversation message and quote it into the composer with one click. The quote keeps its source role, survives sending as a card, and can take you back to the original message.

- Package: `@lifenrir/dsh-selection-quote`
- DSH: `>= 0.2.1-rc.2`
- Node: `^22.19 || >=24`

## What it does

1. Select text inside a user or assistant message. A small toolbar appears above the selection.
2. Click **Quote**. A quote chip is inserted at the composer cursor, the composer regains focus, and the cursor lands after the quote.
3. Send the message. The quote is rendered as a card above the message text.
4. Click the chip or the card to scroll back to the quoted message and flash its outline.

The whole flow is two actions: select, then quote.

## Features

- **One-click quoting** from any user or assistant message; `steering` messages count as user text.
- **Non-destructive insertion**: the existing draft and other composer chips are left untouched, and insertion is a single undo step.
- **Role-labelled source**: the quote block starts with `[Quote] User message` / `[Quote] Assistant reply` (localized), so the model can tell who said it. Turn numbers are never included.
- **Code-aware**: when the selection lies entirely inside one fenced code block, the fence and language are preserved; partial selections fall back to plain text so no unterminated fence is produced.
- **Safe text**: output is plain text (never HTML), delimiters in the quoted body are escaped, and quotes longer than 4000 code points are truncated with a marker.
- **Scoped selection**: only text inside a single message can be quoted. Cross-message selections show a short hint instead of producing a misleading source.
- **Keyboard and theme support**: the toolbar is reachable by Tab, activates with Enter/Space, closes with Escape, uses DSH theme tokens, and respects `prefers-reduced-motion`.
- **Localized** in Chinese and English, following the DSH UI locale.
- **No runtime dependencies** beyond the platform-provided `react`; all `@deepseek-ai/*` imports are type-only.

## Install

### From npm

```sh
dsh plugin add @lifenrir/dsh-selection-quote
```

### From a local directory

```sh
git clone https://github.com/LiFenrir/dsh-selection-quote.git
cd dsh-selection-quote
pnpm install
pnpm build
dsh plugin add /absolute/path/to/dsh-selection-quote
```

`lib/index.js` and `lib/client.js` are committed, so `pnpm build` is only needed after changing `src/`.

### From git

```sh
dsh plugin add git+https://github.com/LiFenrir/dsh-selection-quote.git
```

Reload the Web UI (or restart the profile) after adding and enabling the plugin.

## Usage

- Quote a passage: select it, click **Quote** (or focus the toolbar with Tab and press Enter).
- Dismiss the toolbar: click elsewhere, scroll, press Escape, or press the close button.
- Return to the source: click the quote chip in the composer, or the quote card in a sent message. If the message is not loaded yet, the plugin loads older history pages (up to 8) before giving up.

Quoting is refused while the composer is submitting; a short notice explains why.

## Development

```sh
pnpm install
pnpm build    # esbuild -> lib/index.js + lib/client.js
pnpm test     # vitest (offline, jsdom for component specs)
```

Repository layout:

```text
src/index.ts             Host half (client-only plugin; empty apply)
src/client/              Selection observer, formatting, chip/card, toolbar
tests/                   Vitest specs
scripts/build-client.mjs esbuild bundler; also sets the client module id
lib/                     Built output (committed; shipped in the npm package)
```

**Type checking** is done inside a DSH source checkout. This repository intentionally omits the `tsconfig.json` `paths` entries that point into `deepseek-harness/...`, because those relative paths do not exist here. The shipped `tsconfig.json` keeps the compiler options for editors; run the full `tsc --noEmit` type check with the original tsconfig in the DSH source tree.

The client bundle is a `window.__ModuleLoader__.load({ id, factory })` registration. Its `id` must equal the package name, so `scripts/build-client.mjs` sets `PLUGIN_ID = '@lifenrir/dsh-selection-quote'`.

## How it works

- A session-scoped observer listens for pointer and selection changes, validates that both endpoints belong to one message, and publishes a snapshot to a small root-scoped dock.
- A root-scoped toolbar renders above the selection and insert the quote through DSH's reference-chip insertion path.
- Sent messages pass through a user-text rule that recognizes the quote delimiters and renders a card; both the chip and the card can reveal the source message.
- All registrations go through `ctx.effect()` or slot injections; the plugin adds no Host route and no runtime dependency.

## Known limitations

- Selection is pointer-driven; touch long-press is not handled beyond leaving the native selection menu alone.
- A selection must stay inside one message.
- Jump-back matching uses the quote body as plain text. Markdown markers such as `**` in the first line can prevent a match; the plugin then reports that the source message is not loaded instead of jumping.
- The quote toolbar can linger until the next interaction if the anchored node is replaced without a `selectionchange`; insertion is still rejected safely.
- Only message text is quotable; tool results and reasoning content are excluded.
- Quote length is capped at 4000 code points; there is no quote history manager or "quote into a new session" flow.

## License

MIT. See [LICENSE](LICENSE).
