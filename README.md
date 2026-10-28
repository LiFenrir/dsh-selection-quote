# DSH Selection Quote

[中文](README.zh.md)

Click a quoted excerpt in a sent DSH message to return to the text it quoted, centered in view and briefly highlighted.

- Package: `@lifenrir/dsh-selection-quote`
- DSH: `>= 0.2.1-rc.3`
- Node: `>= 24.9`

> DSH 0.2.1-rc.3 and later ship `@deepseek-ai/dsh-message-quotes`, which already owns selection quoting: select text, click the official **Quote** action, and the quote is inserted into the composer and rendered in the sent message. This plugin deliberately does **not** create quotes. It adds the missing gesture: **click a rendered quote to jump back to its source.**

## What it does

1. Click a quote preview inside a sent message.
2. The plugin finds the source message in the same conversation, loads older history when needed (up to 8 pages), scrolls the source to the vertical center, and highlights the exact quoted passage for about 3 seconds.
3. If the source cannot be found, the composer shows a short notice. Quote previews in the composer remain editable and are never hijacked.

## Features

- **Exact text highlight** through the CSS Custom Highlight API: the range is painted without changing any message class, inline style, or DOM structure. It follows the active light or dark theme.
- **Whole quote when possible**: the complete quoted body is highlighted when the rendered source still carries it; otherwise the first matching line is highlighted.
- **Centered jump** with `scrollIntoView({ block: 'center' })`.
- **Older history**: loads up to 8 pages of earlier messages before declaring the source missing.
- **Same-session only**: a click in one conversation never matches a message from another mounted conversation.
- **Fallback cue**: when the Custom Highlight API is unavailable or the text cannot be located, the source message flashes an outline instead.
- **Non-intrusive**: composer quotes keep their normal editing behavior, and a drag selection across a quote does not trigger a jump.
- **Localized** in Chinese and English.
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

- **Return to the source**: click a quote preview in a sent message. If the source is older than the loaded history, the plugin loads earlier pages first.
- The source message is centered and the quoted passage is highlighted for about 3 seconds; the highlight then disappears and the page is left as it was.
- **Composer quotes** are edited normally and are not jump targets.
- A notice appears when the source can no longer be found in the conversation.

## Development

```sh
pnpm install
pnpm build    # esbuild -> lib/index.js + lib/client.js
pnpm test     # vitest (offline, jsdom for component specs)
```

Repository layout:

```text
src/index.ts                  Host half (client-only plugin; empty apply)
src/client/index.tsx          Client entry: locale, styles, session click observer
src/client/QuoteRevealer.tsx  Session-scoped document click listener
src/client/quote-target.ts    Reads the official [data-quote-preview] DOM
src/client/reveal.ts          Source matching, centering, exact text highlight
tests/                        Vitest specs
scripts/build-client.mjs      esbuild bundler; also sets the client module id
lib/                          Built output (committed; shipped in the npm package)
```

**Type checking** is done inside a DSH source checkout. This repository intentionally omits the `tsconfig.json` `paths` entries that point into `deepseek-harness/...`, because those relative paths do not exist here. The shipped `tsconfig.json` keeps the compiler options for editors; run the full `tsc --noEmit` type check with the original tsconfig in the DSH source tree.

The client bundle is a `window.__ModuleLoader__.load({ id, factory })` registration. Its `id` must equal the package name, so `scripts/build-client.mjs` sets `PLUGIN_ID = '@lifenrir/dsh-selection-quote'`.

## How it works

- The client entry injects a `cursor: pointer` rule for quote previews and a `::highlight(...)` rule for the exact passage.
- A session-scoped observer listens for clicks on the document. It accepts only left clicks on `[data-quote-preview]` inside `[data-chat-node-key]`, outside the composer, when the click did not end a drag selection.
- The source is located by normalized text inside the same `[data-conversation-session]` container, only among messages before the clicked one. Older pages are loaded when needed.
- The source message is scrolled to the center. The exact quoted range is located with a text-node/offset map and painted with the CSS Custom Highlight API; a timer removes the highlight after about 3 seconds.

## Known limitations

- Text matching is the only source link: DSH message quotes carry no message id. If the same first line appears in several earlier messages, the nearest preceding message wins.
- If the rendered source differs from the quote text (for example because of Markdown formatting), the whole quote may not be found; the plugin then highlights the first matching line.
- Quote previews in the composer are intentionally not jump targets; they remain editable.
- The source must be within the loaded history; after 8 older pages the plugin reports it as missing.
- Browsers without the CSS Custom Highlight API fall back to an outline flash on the message.

## License

MIT. See [LICENSE](LICENSE).
