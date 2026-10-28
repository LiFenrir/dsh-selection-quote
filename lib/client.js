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

// src/client/locales.ts
var zh = {
  "notice.sourceMissing": "\u539F\u6D88\u606F\u5DF2\u4E0D\u5728\u5F53\u524D\u4F1A\u8BDD\u4E2D"
};
var en = {
  "notice.sourceMissing": "The quoted message is no longer loaded"
};

// src/client/QuoteRevealer.tsx
var import_react = require("react");

// src/client/quote-target.ts
var QUOTE_SELECTOR = "[data-quote-preview]";
var QUOTE_TEXT_SELECTOR = "[data-quote-preview-text]";
var MESSAGE_SELECTOR = "[data-chat-node-key]";
var EDITABLE_SELECTOR = '[contenteditable="true"]';
function quoteTargetOf(target) {
  if (!(target instanceof Element)) return null;
  const preview = target.closest(QUOTE_SELECTOR);
  if (preview === null) return null;
  if (preview.closest(EDITABLE_SELECTOR) !== null) return null;
  const before = preview.closest(MESSAGE_SELECTOR);
  if (before === null) return null;
  const text = preview.querySelector(QUOTE_TEXT_SELECTOR)?.textContent ?? "";
  if (text.trim() === "") return null;
  return { preview, text, before };
}
function selectionCovers(el) {
  const selection = window.getSelection();
  if (selection === null || selection.isCollapsed || selection.rangeCount === 0) return false;
  return selection.getRangeAt(0).intersectsNode(el);
}

// src/client/QuoteRevealer.tsx
var SESSION_SELECTOR = "[data-conversation-session]";
function QuoteRevealer({ useSession, reveal }) {
  const sessionId = useSession((s) => s.sessionId);
  (0, import_react.useEffect)(() => {
    const onClick = (event) => {
      if (event.button !== 0) return;
      const target = quoteTargetOf(event.target);
      if (target === null || selectionCovers(target.preview)) return;
      const owner = target.before.closest(SESSION_SELECTOR);
      if (owner !== null && owner.getAttribute("data-conversation-session") !== String(sessionId)) return;
      reveal(sessionId, target.text, target.before);
    };
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
    };
  }, [sessionId, reveal]);
  return null;
}

// src/client/reveal.ts
var FLASH_DURATION_MS = 3e3;
var HIGHLIGHT_NAME = "dsh-selection-quote-source";
var MATCH_CODE_POINTS = 60;
var FENCE_LINE = /^`{3,}/;
var NODE_SELECTOR = "[data-chat-node-key]";
var SESSION_SELECTOR2 = "[data-conversation-session]";
var highlightTimer;
function matchKey(body) {
  const line = body.split("\n").find((item) => item.trim() !== "" && !FENCE_LINE.test(item)) ?? "";
  return Array.from(line.replace(/\s+/g, " ").trim()).slice(0, MATCH_CODE_POINTS).join("");
}
function findQuoteSource(doc, body, before) {
  const key = matchKey(body);
  if (key === "") return null;
  const container = before?.closest(SESSION_SELECTOR2);
  const scope = container !== null && container !== void 0 && container.isConnected ? container : doc;
  const nodes = [...scope.querySelectorAll(NODE_SELECTOR)];
  const scoped = before?.isConnected === true ? nodes.filter((node) => (before.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_PRECEDING) !== 0) : nodes;
  const matches = scoped.filter((node) => (node.textContent ?? "").replace(/\s+/g, " ").includes(key));
  return matches.at(-1) ?? null;
}
function textRangeOf(root, key) {
  if (key === "") return null;
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const characters = [];
  const positions = [];
  let previousWasSpace = false;
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const text = node;
    for (let offset = 0; offset < text.data.length; offset++) {
      const char = text.data[offset];
      if (/\s/.test(char)) {
        if (previousWasSpace) continue;
        characters.push(" ");
        previousWasSpace = true;
      } else {
        characters.push(char);
        previousWasSpace = false;
      }
      positions.push({ node: text, offset });
    }
  }
  const index = characters.join("").indexOf(key);
  if (index < 0) return null;
  const start = positions[index];
  const end = positions[index + key.length - 1];
  if (start === void 0 || end === void 0) return null;
  const range = root.ownerDocument.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset + 1);
  return range;
}
function highlightRange(range) {
  if (typeof CSS === "undefined" || typeof Highlight !== "function") return false;
  const registry = CSS.highlights;
  if (registry === void 0) return false;
  try {
    registry.set(HIGHLIGHT_NAME, new Highlight(range));
  } catch {
    return false;
  }
  clearTimeout(highlightTimer);
  highlightTimer = setTimeout(() => {
    registry.delete(HIGHLIGHT_NAME);
  }, FLASH_DURATION_MS);
  return true;
}
function quoteRangeOf(el, body) {
  const key = matchKey(body);
  if (key === "") return null;
  const whole = body.replace(/\s+/g, " ").trim();
  if (whole !== key) {
    const range = textRangeOf(el, whole);
    if (range !== null) return range;
  }
  return textRangeOf(el, key);
}
function revealElement(el, body) {
  if (typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "center", behavior: "smooth" });
  const range = quoteRangeOf(el, body);
  if (range !== null && highlightRange(range)) return;
  flashOutline(el);
}
function flashOutline(el) {
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

// src/client/index.tsx
var NS = "selectionQuote";
var LOAD_OLDER_MAX_PAGES = 8;
var nextFrame = () => new Promise((resolve) => {
  requestAnimationFrame(() => {
    resolve();
  });
});
var inject = ["slots", "locale", "sessions", "conversation"];
function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "selection-quote: locale");
  const t = ctx.locale.bind(NS);
  const reveal = (sessionId, body, before) => {
    void (async () => {
      const binding = ctx.sessions.binding(sessionId);
      if (binding === void 0) return;
      let found = findQuoteSource(document, body, before);
      for (let page = 0; found === null && binding.session.getSnapshot().hasMore && page < LOAD_OLDER_MAX_PAGES; page++) {
        await binding.session.loadOlder();
        await nextFrame();
        found = findQuoteSource(document, body, before);
      }
      if (found !== null) {
        revealElement(found, body);
        return;
      }
      const live = ctx.sessions.binding(sessionId);
      if (live !== void 0) ctx.conversation.input.for(live.ctx).notify("info", t("notice.sourceMissing"));
    })();
  };
  ctx.effect(() => {
    const style = document.createElement("style");
    style.textContent = [
      "[data-chat-node-key] [data-quote-preview]{cursor:pointer}",
      `::highlight(${HIGHLIGHT_NAME}){background-color: color-mix(in srgb, var(--dsw-alias-state-business-primary) 24%, transparent);}`
    ].join("\n");
    document.head.append(style);
    return () => {
      style.remove();
    };
  }, "selection-quote: affordance");
  ctx.slots.inject("conversation.input.overlay", () => ctx.slots.register({
    name: "conversation.input.overlay",
    id: "selection-quote-reveal",
    inject: () => ({ reveal })
  }, QuoteRevealer));
}

    return module.exports
  },
})
