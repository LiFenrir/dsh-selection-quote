window.__ModuleLoader__.load({
  id: "@lifenrir/dsh-selection-quote",
  factory: (require) => {
    var module = { exports: {} }; var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/client/dock.ts
var IDLE = { phase: "idle" };
function createDock() {
  let snapshot = IDLE;
  const listeners = /* @__PURE__ */ new Set();
  const publish = (next) => {
    snapshot = next;
    for (const listener of listeners) listener();
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    show(selection) {
      publish({ phase: "visible", selection });
    },
    block(reason, rect) {
      publish({ phase: "blocked", reason, rect });
    },
    hide() {
      if (snapshot.phase === "idle") return;
      publish(IDLE);
    }
  };
}

// src/client/format.ts
var FLOW_KINDS = ["user", "steering", "assistant-step"];
var DEFAULT_QUOTE_LIMIT = 4e3;
function normalize(raw) {
  return raw.trim().replace(/\n{3,}/g, "\n\n");
}
function truncate(text, limit, messages) {
  const chars = Array.from(text);
  if (chars.length <= limit) return text;
  const note = fill(messages.truncated, { count: String(chars.length) });
  return `${chars.slice(0, limit).join("")}
${note}`;
}
function formatQuoteBody(input) {
  const limit = input.limit ?? DEFAULT_QUOTE_LIMIT;
  const { messages } = input;
  if (input.code === void 0) {
    return escapeDelimiters(truncate(normalize(input.raw), limit, messages), messages);
  }
  const body = escapeDelimiters(truncate(input.code.text, limit, messages), messages);
  const fence = fenceFor(body);
  return `${fence}${input.code.lang ?? ""}
${body}
${fence}`;
}
function roleLabel(flowKind, messages) {
  return flowKind === "assistant-step" ? messages.assistant : messages.user;
}
function composeSourceLabel(flowKind, messages) {
  return roleLabel(flowKind, messages);
}
function quoteBlock(body, sourceLabel, messages) {
  return `${messages.open}${sourceLabel}
${body}
${messages.close}`;
}
function escapeDelimiters(body, messages) {
  return body.split(messages.open).join(messages.escapeOpen).split(messages.close).join(messages.escapeClose);
}
function fenceFor(body) {
  let longest = 0;
  for (const run of body.matchAll(/`+/g)) longest = Math.max(longest, run[0].length);
  return "`".repeat(Math.max(3, longest + 1));
}
function fill(template, params) {
  let out = template;
  for (const [name, value] of Object.entries(params)) out = out.split(`{${name}}`).join(value);
  return out;
}

// src/client/reference.ts
var QUOTE_SOURCE = "quote";
var QUOTE_TRIGGER = "@";
var REF_PREFIX = "sq2.";
var LEGACY_REF_PREFIX = "sq1.";
var PREVIEW_CODE_POINTS = 20;
var FENCE_LINE = /^`{3,}/;
var BINARY_CHUNK = 32768;
function toBase64Url(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let i = 0; i < bytes.length; i += BINARY_CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + BINARY_CHUNK));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromBase64Url(body) {
  const base64 = body.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
  const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
function isQuoteRef(value) {
  return typeof value === "object" && value !== null && "text" in value && typeof value.text === "string" && "nodeKey" in value && typeof value.nodeKey === "string" && "flowKind" in value && typeof value.flowKind === "string" && FLOW_KINDS.includes(value.flowKind);
}
function encodeQuoteRef(ref) {
  return REF_PREFIX + toBase64Url(JSON.stringify(ref));
}
function decodeQuoteRef(ref) {
  if (ref.startsWith(LEGACY_REF_PREFIX)) return { text: fromBase64Url(ref.slice(LEGACY_REF_PREFIX.length)) };
  if (!ref.startsWith(REF_PREFIX)) throw new Error("quote reference has an unknown format");
  const payload = JSON.parse(fromBase64Url(ref.slice(REF_PREFIX.length)));
  if (!isQuoteRef(payload)) throw new Error("quote reference payload is malformed");
  return payload;
}
function chipLabel(template, role, body) {
  const lines = body.split("\n");
  const line = lines.find((item) => item.trim() !== "" && !FENCE_LINE.test(item)) ?? lines[0];
  const chars = Array.from(line);
  const cut = chars.length > PREVIEW_CODE_POINTS || lines.length > 1;
  const preview = chars.slice(0, PREVIEW_CODE_POINTS).join("") + (cut ? "\u2026" : "");
  return template.split("{role}").join(role).split("{preview}").join(preview);
}
function buildQuoteReference(input) {
  const padded = `

${input.modelText}

`;
  return {
    source: QUOTE_SOURCE,
    ref: encodeQuoteRef({ text: padded, nodeKey: input.nodeKey, flowKind: input.flowKind }),
    label: input.label,
    appearance: "session",
    clipboardText: padded
  };
}
var quoteCodec = {
  clipboardText: (ref) => decodeQuoteRef(ref).text,
  serialize: async (ref) => decodeQuoteRef(ref).text
};

// src/client/locales.ts
var zh = {
  "action.quote": "\u5F15\u7528",
  "action.close": "\u5173\u95ED",
  "toolbar.label": "\u5212\u8BCD\u5F15\u7528",
  "hint.crossNode": "\u8BF7\u5728\u540C\u4E00\u6BB5\u6D88\u606F\u5185\u9009\u62E9",
  "notice.busy": "\u8F93\u5165\u6846\u6B63\u5728\u63D0\u4EA4\uFF0C\u7A0D\u540E\u518D\u5F15\u7528",
  "notice.insertFailed": "\u5F15\u7528\u63D2\u5165\u5931\u8D25\uFF0C\u8BF7\u91CD\u65B0\u9009\u62E9",
  "notice.sourceMissing": "\u539F\u6D88\u606F\u5DF2\u4E0D\u5728\u5F53\u524D\u4F1A\u8BDD\u4E2D",
  "source.user": "\u7528\u6237\u6D88\u606F",
  "source.assistant": "\u52A9\u624B\u56DE\u590D",
  "card.label": "\u5F15\u7528",
  "card.reveal": "\u56DE\u5230\u539F\u5904",
  "chip.label": "\u5F15\u7528 \xB7 {role} \xB7 {preview}",
  "format.open": "\u3010\u5F15\u7528\u3011",
  "format.close": "\u3010/\u5F15\u7528\u3011",
  "format.escapeOpen": "\u3014\u5F15\u7528\u3015",
  "format.escapeClose": "\u3014/\u5F15\u7528\u3015",
  "format.truncated": "\u2026\uFF08\u5F15\u7528\u5DF2\u622A\u65AD\uFF0C\u539F\u6587 {count} \u5B57\u7B26\uFF09"
};
var en = {
  "action.quote": "Quote",
  "action.close": "Close",
  "toolbar.label": "Selection quote",
  "hint.crossNode": "Select within a single message",
  "notice.busy": "The composer is submitting; quote again shortly",
  "notice.insertFailed": "Could not insert the quote; select again",
  "notice.sourceMissing": "The quoted message is no longer loaded",
  "source.user": "User message",
  "source.assistant": "Assistant reply",
  "card.label": "Quote",
  "card.reveal": "Jump to source",
  "chip.label": "Quote \xB7 {role} \xB7 {preview}",
  "format.open": "[Quote]",
  "format.close": "[/Quote]",
  "format.escapeOpen": "(Quote)",
  "format.escapeClose": "(/Quote)",
  "format.truncated": "\u2026(quote truncated, original {count} characters)"
};

// src/client/quote-card.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var QUOTE_CARD_CSS = `
.dsh-quote-card {
  display: inline-flex;
  flex-direction: column;
  gap: 4px;
  max-width: 100%;
  box-sizing: border-box;
  vertical-align: top;
  padding: 6px 10px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: var(--dsw-radius-md);
  background: var(--dsw-alias-bg-layer-2);
  cursor: pointer;
}
.dsh-quote-card:hover {
  border-color: var(--dsw-alias-state-business-primary);
}
.dsh-quote-card:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary);
  outline-offset: 1px;
}
.dsh-quote-card-label {
  font-size: 12px;
  line-height: 1.4;
  color: var(--dsw-alias-label-secondary);
}
.dsh-quote-card-body {
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--dsw-alias-label-primary);
}
`;
function hasSelectionOn(el) {
  const selection = window.getSelection();
  if (selection === null || selection.isCollapsed) return false;
  return selection.getRangeAt(0).intersectsNode(el);
}
function QuoteCard({ node, raw, t, useSession, revealQuote }) {
  const sessionId = useSession((s) => s.sessionId);
  const body = node.data.body === "" ? raw : node.data.body;
  const reveal = (card) => {
    revealQuote({
      body: node.data.body,
      role: node.data.role,
      sessionId,
      before: card.closest("[data-chat-node-key]") ?? void 0
    });
  };
  const onClick = (event) => {
    if (hasSelectionOn(event.currentTarget)) return;
    reveal(event.currentTarget);
  };
  const onKeyDown = (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    reveal(event.currentTarget);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("style", { children: QUOTE_CARD_CSS }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        className: "dsh-quote-card",
        role: "button",
        tabIndex: 0,
        "aria-label": t("card.reveal"),
        onClick,
        onKeyDown,
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsh-quote-card-label", children: t("card.label") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-quote-card-body", children: body })
        ]
      }
    )
  ] });
}

// src/client/reveal.ts
var FLASH_DURATION_MS = 1200;
var MATCH_CODE_POINTS = 60;
var FENCE_LINE2 = /^`{3,}/;
var NODE_SELECTOR = "[data-chat-node-key]";
var ROLE_FLOW_KINDS = {
  assistant: ["assistant-step"],
  user: ["user", "steering"]
};
function matchKey(body) {
  const line = body.split("\n").find((item) => item.trim() !== "" && !FENCE_LINE2.test(item)) ?? "";
  return Array.from(line.replace(/\s+/g, " ").trim()).slice(0, MATCH_CODE_POINTS).join("");
}
function findQuoteSource(doc, target, before) {
  const nodes = [...doc.querySelectorAll(NODE_SELECTOR)];
  if (target.nodeKey) {
    const exact = nodes.find((node) => node.getAttribute("data-chat-node-key") === target.nodeKey);
    if (exact !== void 0) return exact;
  }
  const key = matchKey(target.body);
  if (key === "") return null;
  const kinds = target.flowKind !== void 0 ? [target.flowKind] : target.role !== void 0 ? ROLE_FLOW_KINDS[target.role] : void 0;
  const matches = nodes.filter((node) => {
    if (before !== void 0 && (before.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_PRECEDING) === 0) return false;
    if (kinds !== void 0 && !kinds.includes(node.getAttribute("data-chat-flow-kind") ?? "")) return false;
    return (node.textContent ?? "").replace(/\s+/g, " ").includes(key);
  });
  return matches.at(-1) ?? null;
}
function revealElement(el) {
  if (typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "center", behavior: "smooth" });
  if (typeof el.animate !== "function") return;
  try {
    el.animate(
      [
        { outline: "2px solid var(--dsw-alias-brand-primary)", outlineOffset: "3px" },
        { outline: "2px solid transparent", outlineOffset: "3px" }
      ],
      { duration: FLASH_DURATION_MS, easing: "ease-out" }
    );
  } catch {
  }
}

// src/client/observer.tsx
var import_react = require("react");

// src/client/select.ts
var NODE_SELECTOR2 = "[data-chat-node-key]";
var EXCLUDED_SELECTOR = '[contenteditable="true"], [data-ref-chip], button, a, [role="dialog"]';
var SKIPPED_SELECTOR = '[data-code-block-banner], button, svg, [aria-hidden="true"]';
var CODE_BLOCK_SELECTOR = ".md-code-block";
var FLOW_KINDS2 = ["user", "steering", "assistant-step"];
var BLOCK_TAGS = /* @__PURE__ */ new Set(["P", "DIV", "LI", "PRE", "BLOCKQUOTE", "H1", "H2", "H3", "H4", "H5", "H6", "TR"]);
var LANG_PATTERN = /^[A-Za-z][\w+#.-]{0,19}$/u;
var MIN_VISIBLE_CHARS = 2;
function captureSelection(doc, sessionId) {
  const selection = doc.getSelection();
  if (selection === null || selection.rangeCount === 0 || selection.isCollapsed) return { kind: "none" };
  const range = selection.getRangeAt(0);
  const startNode = allowedNodeOf(range.startContainer);
  const endNode = allowedNodeOf(range.endContainer);
  if (startNode === void 0 || endNode === void 0) return { kind: "none" };
  const startFlow = flowKindOf(startNode);
  const endFlow = flowKindOf(endNode);
  if (startFlow === void 0 || endFlow === void 0) return { kind: "none" };
  const rect = toRect(range.getBoundingClientRect());
  if (startNode !== endNode) return { kind: "cross-node", rect };
  const code = codeBlockOf(range);
  const text = code === void 0 ? extractText(range) : (code.pre.textContent ?? "").replace(/\n+$/u, "");
  if (text.replace(/\s/gu, "").length < MIN_VISIBLE_CHARS) return { kind: "none" };
  return {
    kind: "selection",
    selection: {
      text,
      flowKind: startFlow,
      nodeKey: startNode.getAttribute("data-chat-node-key") ?? "",
      rect,
      anchor: startNode,
      sessionId,
      code: code === void 0 ? void 0 : { lang: languageOf(code.block), text }
    }
  };
}
function codeBlockOf(range) {
  const startBlock = elementOf(range.startContainer)?.closest(CODE_BLOCK_SELECTOR);
  const endBlock = elementOf(range.endContainer)?.closest(CODE_BLOCK_SELECTOR);
  if (startBlock === void 0 || startBlock === null || startBlock !== endBlock) return void 0;
  const pre = startBlock.querySelector("[data-code-block-content] pre");
  if (pre === null) return void 0;
  const preRange = pre.ownerDocument.createRange();
  preRange.selectNodeContents(pre);
  const covers = range.compareBoundaryPoints(Range.START_TO_START, preRange) <= 0 && range.compareBoundaryPoints(Range.END_TO_END, preRange) >= 0;
  return covers ? { block: startBlock, pre } : void 0;
}
function isAllowedContainer(el) {
  return el !== null && el.closest(EXCLUDED_SELECTOR) === null && el.closest(NODE_SELECTOR2) !== null;
}
function allowedNodeOf(node) {
  const el = elementOf(node);
  if (!isAllowedContainer(el)) return void 0;
  return el.closest(NODE_SELECTOR2) ?? void 0;
}
function flowKindOf(node) {
  const kind = node.getAttribute("data-chat-flow-kind");
  return kind !== null && FLOW_KINDS2.includes(kind) ? kind : void 0;
}
function extractText(range) {
  const out = [];
  for (const node of range.cloneContents().childNodes) collect(node, out);
  return out.join("");
}
function collect(node, out) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? "";
    if (text !== "") out.push(text);
    return;
  }
  if (!(node instanceof Element) || node.matches(SKIPPED_SELECTOR)) return;
  if (node.tagName === "BR") {
    out.push("\n");
    return;
  }
  const block = BLOCK_TAGS.has(node.tagName);
  if (block) breakLine(out);
  for (const child of node.childNodes) collect(child, out);
  if (block) breakLine(out);
}
function breakLine(out) {
  if (out.length > 0 && !out[out.length - 1].endsWith("\n")) out.push("\n");
}
function languageOf(block) {
  if (block.querySelector("pre.shiki") === null) return void 0;
  const head = block.querySelector("[data-code-block-banner]")?.firstElementChild;
  if (head === void 0 || head === null) return void 0;
  const label = (head.firstElementChild ?? head).textContent?.trim() ?? "";
  return LANG_PATTERN.test(label) ? label : void 0;
}
function elementOf(node) {
  return node instanceof Element ? node : node.parentElement;
}
function toRect(r) {
  return { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
}

// src/client/observer.tsx
var COMMIT_DELAY_MS = 150;
var BLOCK_HINT_MS = 1500;
function SelectionObserver(props) {
  const { useSession, inputActions, t, dock, bind, unbind } = props;
  const sessionId = useSession((s) => s.sessionId);
  const tRef = (0, import_react.useRef)(t);
  tRef.current = t;
  (0, import_react.useEffect)(() => {
    let pending;
    let lastApplied;
    let composing = false;
    let frame = 0;
    let commitTimer;
    let blockTimer;
    const evaluate = () => {
      if (composing) return;
      const result = captureSelection(document, sessionId);
      if (result.kind === "none") {
        pending = void 0;
        lastApplied = void 0;
        dock.hide();
        return;
      }
      if (result.kind === "cross-node") {
        pending = void 0;
        dock.block("cross-node", result.rect);
        clearTimeout(blockTimer);
        blockTimer = setTimeout(() => {
          if (dock.getSnapshot().phase === "blocked") dock.hide();
        }, BLOCK_HINT_MS);
        return;
      }
      const { selection } = result;
      const selectionText = document.getSelection()?.toString() ?? "";
      if (selectionText === lastApplied) {
        dock.hide();
        return;
      }
      const messages = buildMessages(tRef.current);
      const sourceLabel = composeSourceLabel(selection.flowKind, messages);
      const body = formatQuoteBody({
        raw: selection.text,
        flowKind: selection.flowKind,
        code: selection.code,
        messages
      });
      const payload = {
        modelText: quoteBlock(body, sourceLabel, messages),
        label: chipLabel(tRef.current("chip.label"), roleLabel(selection.flowKind, messages), body),
        nodeKey: selection.nodeKey,
        flowKind: selection.flowKind
      };
      pending = { payload, anchor: selection.anchor, selectionText };
      dock.show({
        text: body,
        sourceLabel,
        nodeKey: selection.nodeKey,
        flowKind: selection.flowKind,
        rect: selection.rect,
        sessionId,
        capturedAt: Date.now()
      });
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        clearTimeout(commitTimer);
        commitTimer = setTimeout(evaluate, COMMIT_DELAY_MS);
      });
    };
    const offer = () => {
      const current = pending;
      if (current === void 0) return void 0;
      return {
        payload: current.payload,
        isAnchored: () => current.anchor.isConnected,
        captureInsertion: () => inputActions.captureInsertion(),
        markApplied: () => {
          lastApplied = current.selectionText;
          pending = void 0;
        }
      };
    };
    const hide = () => {
      dock.hide();
    };
    const onPointerUp = (event) => {
      if (event.button !== 0) return;
      if (event.target instanceof Element && event.target.closest(".dsh-quote-toolbar") !== null) return;
      schedule();
    };
    const onSelectionChange = () => {
      const current = document.getSelection();
      if (dock.getSnapshot().phase === "visible" && (current === null || current.toString() !== pending?.selectionText)) {
        dock.hide();
      }
      schedule();
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") dock.hide();
    };
    const onCompositionStart = () => {
      composing = true;
    };
    const onCompositionEnd = () => {
      composing = false;
      schedule();
    };
    bind({ sessionId, offer });
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("compositionstart", onCompositionStart);
    document.addEventListener("compositionend", onCompositionEnd);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("compositionstart", onCompositionStart);
      document.removeEventListener("compositionend", onCompositionEnd);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
      cancelAnimationFrame(frame);
      clearTimeout(commitTimer);
      clearTimeout(blockTimer);
      unbind(sessionId);
      dock.hide();
    };
  }, [sessionId, inputActions, dock, bind, unbind]);
  return null;
}
function buildMessages(t) {
  return {
    open: t("format.open"),
    close: t("format.close"),
    escapeOpen: t("format.escapeOpen"),
    escapeClose: t("format.escapeClose"),
    user: t("source.user"),
    assistant: t("source.assistant"),
    truncated: t("format.truncated")
  };
}

// src/client/user-text-rule.ts
var SOURCE_LINE_MAX = 120;
function quoteMessages() {
  return [zh, en].map((dict) => ({ open: dict["format.open"], close: dict["format.close"] }));
}
function escapeRegExp(literal) {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function roleOf(source) {
  if (source === zh["source.assistant"] || source === en["source.assistant"]) return "assistant";
  if (source === zh["source.user"] || source === en["source.user"]) return "user";
  return void 0;
}
function findQuote(text, from, delimiters) {
  const pattern = new RegExp(
    `${escapeRegExp(delimiters.open)}([^\\r\\n]{1,${SOURCE_LINE_MAX}})\\r?\\n([\\s\\S]*?)\\r?\\n${escapeRegExp(delimiters.close)}`,
    "gu"
  );
  pattern.lastIndex = from;
  for (let found = pattern.exec(text); found !== null; found = pattern.exec(text)) {
    const body = found[2].replace(/\r?\n$/, "");
    if (body.trim().length > 0) {
      return { start: found.index, end: found.index + found[0].length, body, role: roleOf(found[1]) };
    }
  }
  return void 0;
}
function firstQuote(text, from) {
  let best;
  for (const delimiters of quoteMessages()) {
    const found = findQuote(text, from, delimiters);
    if (found !== void 0 && (best === void 0 || found.start < best.start)) best = found;
  }
  return best;
}
function quoteBlockOf(text) {
  const best = firstQuote(text, 0);
  return best === void 0 ? void 0 : { body: best.body, role: best.role };
}
var quoteTextRule = {
  id: "selection-quote",
  order: 5,
  match(text, from) {
    const best = firstQuote(text, from);
    if (best === void 0) return void 0;
    return { id: "selection-quote", start: best.start, end: best.end, data: { body: best.body, role: best.role } };
  }
};

// src/client/toolbar.tsx
var import_react2 = require("react");
var import_jsx_runtime2 = require("react/jsx-runtime");
var TOOLBAR_GAP = 8;
var VIEWPORT_MARGIN = 8;
function placeToolbar(rect, size, viewport) {
  let top = rect.top - TOOLBAR_GAP - size.height;
  if (top < VIEWPORT_MARGIN) top = rect.bottom + TOOLBAR_GAP;
  const centered = rect.left + rect.width / 2 - size.width / 2;
  const maxLeft = viewport.width - size.width - VIEWPORT_MARGIN;
  return { top, left: Math.max(VIEWPORT_MARGIN, Math.min(centered, maxLeft)) };
}
function QuoteToolbar({ useSelectionQuote, applyQuote, dismiss, t }) {
  const snapshot = useSelectionQuote((s) => s);
  const ref = (0, import_react2.useRef)(null);
  const [placed, setPlaced] = (0, import_react2.useState)();
  const rect = snapshot.phase === "idle" ? void 0 : snapshot.phase === "blocked" ? snapshot.rect : snapshot.selection.rect;
  const active = rect !== void 0;
  (0, import_react2.useLayoutEffect)(() => {
    const el = ref.current;
    if (rect === void 0 || el === null) {
      setPlaced(void 0);
      return;
    }
    const box = el.getBoundingClientRect();
    setPlaced(placeToolbar(rect, { width: box.width, height: box.height }, { width: window.innerWidth, height: window.innerHeight }));
  }, [rect]);
  (0, import_react2.useEffect)(() => {
    if (!active) return;
    const onPointerDown = (event) => {
      if (event.target instanceof Node && ref.current?.contains(event.target)) return;
      dismiss();
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") dismiss();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [active, dismiss]);
  if (snapshot.phase === "idle") return null;
  const blocked = snapshot.phase === "blocked";
  const style = {
    top: placed?.top ?? 0,
    left: placed?.left ?? 0,
    visibility: placed === void 0 ? "hidden" : void 0
  };
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("style", { children: QUOTE_CSS }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "div",
      {
        ref,
        className: "dsh-quote-toolbar",
        role: blocked ? "status" : "toolbar",
        "aria-label": blocked ? void 0 : t("toolbar.label"),
        style,
        onPointerDown: (event) => {
          event.preventDefault();
        },
        onMouseDown: (event) => {
          event.preventDefault();
        },
        onKeyDown: (event) => {
          if (event.key === "Escape") dismiss();
        },
        children: blocked ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dsh-quote-hint", children: t("hint.crossNode") }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "dsh-quote-btn", onClick: () => {
            applyQuote(snapshot.selection.sessionId);
          }, children: t("action.quote") }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "dsh-quote-close", "aria-label": t("action.close"), onClick: dismiss, children: "\xD7" })
        ] })
      }
    )
  ] });
}
var QUOTE_CSS = `
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
`;

// src/client/index.tsx
var NS = "selectionQuote";
var LOAD_OLDER_MAX_PAGES = 8;
var nextFrame = () => new Promise((resolve) => {
  requestAnimationFrame(() => {
    resolve();
  });
});
var inject = ["slots", "locale", "sessions", "conversation", "inputTriggers", "uiConversation"];
function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "selection-quote: locale");
  const t = ctx.locale.bind(NS);
  const dock = createDock();
  let bound;
  const bind = (next) => {
    bound = next;
  };
  const unbind = (sessionId) => {
    if (bound?.sessionId === sessionId) bound = void 0;
  };
  const insertQuote = (sessionId) => {
    if (bound === void 0 || bound.sessionId !== sessionId) return "stale";
    const binding = ctx.sessions.binding(sessionId);
    if (binding === void 0) return "stale";
    const input = ctx.conversation.input.for(binding.ctx);
    if (input.state.getSnapshot().phase !== "plain") {
      input.notify("info", t("notice.busy"));
      return "locked";
    }
    const offer = bound.offer();
    if (offer === void 0 || !offer.isAnchored()) return "stale";
    const reference = buildQuoteReference(offer.payload);
    const span = offer.captureInsertion();
    const inserted = binding.ctx.bail(binding.ctx, "slash/input-insert-reference", { reference, span }) === true;
    if (!inserted) {
      input.notify("error", t("notice.insertFailed"));
      return "failed";
    }
    offer.markApplied();
    input.focus();
    return "inserted";
  };
  const applyQuote = (sessionId) => {
    const outcome = insertQuote(sessionId);
    dock.hide();
    return outcome;
  };
  const reveal = async (sessionId, target, before) => {
    const binding = ctx.sessions.binding(sessionId);
    if (binding === void 0) return;
    let found = findQuoteSource(document, target, before);
    for (let page = 0; found === null && binding.session.getSnapshot().hasMore && page < LOAD_OLDER_MAX_PAGES; page++) {
      await binding.session.loadOlder();
      await nextFrame();
      found = findQuoteSource(document, target, before);
    }
    if (found !== null) {
      revealElement(found);
      return;
    }
    const live = ctx.sessions.binding(sessionId);
    if (live !== void 0) ctx.conversation.input.for(live.ctx).notify("info", t("notice.sourceMissing"));
  };
  const revealFromRef = (ref, sessionId) => {
    let decoded;
    try {
      decoded = decodeQuoteRef(ref);
    } catch {
      return false;
    }
    const block = quoteBlockOf(decoded.text);
    void reveal(sessionId, {
      body: block?.body ?? "",
      role: block?.role,
      nodeKey: decoded.nodeKey,
      flowKind: decoded.flowKind
    });
    return true;
  };
  const revealQuote = (input) => {
    void reveal(input.sessionId, { body: input.body, role: input.role }, input.before);
  };
  ctx.effect(() => ctx.inputTriggers.registerSource({
    trigger: QUOTE_TRIGGER,
    name: QUOTE_SOURCE,
    order: 200,
    showGroupTitle: false,
    candidates: async () => [],
    onPick: () => void 0,
    openReference: (session, reference) => revealFromRef(reference.ref, session.sessionId),
    codec: quoteCodec
  }), "selection-quote: reference source");
  ctx.effect(() => ctx.uiConversation.userText.register(quoteTextRule), "selection-quote: user-text rule");
  ctx.slots.inject("conversation.user.text.node", () => ctx.slots.register({
    name: "conversation.user.text.node",
    key: "selection-quote",
    priority: 100,
    locale: NS,
    inject: () => ({ revealQuote })
  }, QuoteCard));
  ctx.slots.provideRoot({ hooks: { selectionQuote: dock } });
  ctx.slots.inject("conversation.input.overlay", () => ctx.slots.register({
    name: "conversation.input.overlay",
    id: "selection-quote-observer",
    locale: NS,
    inject: () => ({ dock, bind, unbind })
  }, SelectionObserver));
  ctx.slots.inject("shell.overlay", () => ctx.slots.register({
    name: "shell.overlay",
    id: "selection-quote-toolbar",
    locale: NS,
    inject: () => ({ applyQuote, dismiss: () => {
      dock.hide();
    } })
  }, QuoteToolbar));
}

    return module.exports
  },
})
