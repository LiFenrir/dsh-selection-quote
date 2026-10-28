# DSH 点击引用回原文

[English](README.md)

点击已发送消息里的引用，回到被引用的原文：滚动到屏幕中间，并短暂高亮引用文字。

- 包名：`@lifenrir/dsh-selection-quote`
- DSH：`>= 0.2.1-rc.3`
- Node：`>= 24.9`

> DSH 0.2.1-rc.3 起，官方 `@deepseek-ai/dsh-message-quotes` 已提供划词引用：划选文字后点击官方「引用文本」，引用会进入输入框并在发送后渲染在消息里。本插件**不再创建引用**，只补上官方缺少的一步：**点击已渲染的引用，回到它的原文**。

## 功能说明

1. 点击已发送消息里的官方引用预览。
2. 插件在同一会话内找到源消息；不够则继续加载更早历史（最多 8 页）；把源消息滚动到屏幕垂直中间，并用约 3 秒高亮被引用的那段文字。
3. 找不到源消息时在输入框给出提示；输入框里的引用保持可编辑，不会被劫持。

## 功能点

- **精确文字高亮**：通过 CSS Custom Highlight API 绘制 Range，不修改任何消息节点的 class、内联样式或 DOM 结构；自动适配亮/暗主题。
- **整段优先**：渲染后的源文本仍包含整段引用时高亮整段；否则退化为首行匹配段。
- **居中跳转**：`scrollIntoView({ block: 'center' })`。
- **更早历史**：源消息不在当前加载范围内时，最多继续加载 8 页历史。
- **同会话隔离**：只会在被点击消息所属的会话容器内查找，不会跳到另一个同时挂载的会话。
- **兜底提示**：Custom Highlight API 不可用或文本定位失败时，对源消息做一次 outline 闪烁。
- **不打扰编辑**：输入框里的引用保持官方编辑行为；在引用上拖选文字后松手不会误跳转。
- **中英双语**。
- **零运行时依赖**：除平台提供的 `react` 外不加载其他模块；所有 `@deepseek-ai/*` 引用均为 type-only。

## 安装

### 从 npm 安装

```sh
dsh plugin add @lifenrir/dsh-selection-quote
```

### 从本地目录安装

```sh
git clone https://github.com/LiFenrir/dsh-selection-quote.git
cd dsh-selection-quote
pnpm install
pnpm build
dsh plugin add /absolute/path/to/dsh-selection-quote
```

`lib/index.js` 与 `lib/client.js` 已提交到仓库；只有在修改 `src/` 后才需要重新 `pnpm build`。

### 从 git 安装

```sh
dsh plugin add git+https://github.com/LiFenrir/dsh-selection-quote.git
```

添加并启用插件后，刷新 Web UI（或重启 profile）。

## 使用

- **回到来源**：点击已发送消息里的引用预览。若源消息比已加载历史更早，插件会先加载更早的页面。
- 源消息会滚动到屏幕中间，被引用的文字高亮约 3 秒后自动消失，页面保持原样。
- **输入框里的引用**保持可编辑，不是跳转目标。
- 源消息已不在当前会话中时，输入框会给出提示。

## 开发

```sh
pnpm install
pnpm build    # esbuild -> lib/index.js + lib/client.js
pnpm test     # vitest（离线；组件测试使用 jsdom）
```

仓库结构：

```text
src/index.ts                  Host 半（纯客户端插件，apply 为空）
src/client/index.tsx          客户端入口：locale、样式、会话级点击监听
src/client/QuoteRevealer.tsx  会话作用域的 document 点击监听
src/client/quote-target.ts    读取官方 [data-quote-preview] DOM
src/client/reveal.ts          源消息匹配、居中、精确文字高亮
tests/                        Vitest 测试
scripts/build-client.mjs      esbuild 打包，同时设定 client 模块 id
lib/                          构建产物（已提交，随 npm 包发布）
```

**类型检查**在 DSH 源码树内完成。本仓库有意省略了 `tsconfig.json` 中指向 `deepseek-harness/...` 的 `paths` 映射，因为这些相对路径在独立仓库中不存在。发布版 `tsconfig.json` 保留编辑器所需的编译选项；完整的 `tsc --noEmit` 检查请在 DSH 源码树内使用原始 tsconfig 运行。

客户端 bundle 是 `window.__ModuleLoader__.load({ id, factory })` 注册，其中 `id` 必须等于包名，因此 `scripts/build-client.mjs` 中设置 `PLUGIN_ID = '@lifenrir/dsh-selection-quote'`。

## 工作原理

- 客户端入口注入两条样式：引用预览的 `cursor: pointer`，以及精确高亮用的 `::highlight(...)` 规则。
- session 作用域的观察者监听 document 点击；只接受 `[data-chat-node-key]` 内、`[data-quote-preview]` 上、输入框之外、且不是拖选结束的左键点击。
- 在同一个 `[data-conversation-session]` 容器内、被点击消息之前的消息中，按空白折叠后的文本定位源消息；不够则加载更早页面。
- 源消息滚动到屏幕中间；用文本节点/偏移映射找到引用的精确 Range，通过 CSS Custom Highlight API 绘制；约 3 秒后自动移除。

## 已知限制

- 官方引用只保存纯文本，没有消息 id，因此只能按文本定位源消息；如果同一行在更早的多条消息里出现，会取最近的一条。
- 渲染后的源文本与引用正文存在格式差异（例如 Markdown 标记）时，可能找不到整段；此时退化为高亮首行匹配段。
- 输入框里的引用有意不作为跳转目标，保持可编辑。
- 源消息必须在已加载历史内；加载 8 页仍找不到时会提示来源缺失。
- 不支持 CSS Custom Highlight API 的浏览器会退化为整条消息的 outline 闪烁。

## 许可证

MIT，见 [LICENSE](LICENSE)。
