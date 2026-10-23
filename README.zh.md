# DSH 划词引用

[English](README.md)

在会话消息中划选文字，一键引用到输入框。引用会标注来源角色，发送后显示为卡片，并支持点击回到原消息。

- 包名：`@lifenrir/dsh-selection-quote`
- DSH：`>= 0.2.1-rc.2`
- Node：`^22.19 || >=24`

## 功能说明

1. 在用户消息或助手回复中划选文字，选区上方浮出工具条。
2. 点击 **引用**。引用 chip 插入到输入框光标处，焦点回到输入框，光标落在引用之后。
3. 发送消息后，引用以卡片形式显示在正文上方。
4. 点击 chip 或卡片，滚动回被引用的消息并闪烁高亮。

整个流程只有两步：划选、点击引用。

## 功能点

- **一键引用**用户消息与助手回复；`steering` 消息按用户文本处理。
- **不破坏草稿**：已有草稿和其他 chip 原样保留，插入可作为一次操作撤销。
- **标注来源角色**：引用块以「引用 · 用户消息 / 助手回复」开头（随语言切换），不写轮次，模型能识别发言者。
- **代码块感知**：选区完全落在一个围栏代码块内时保留围栏与语言；只选中部分时退化为纯文本，避免产生不闭合的围栏。
- **纯文本安全**：输出为纯文本（不渲染 HTML），正文中的定界符会被转义；超过 4000 码点会截断并标注。
- **单条消息限制**：只能引用同一条消息内的文字；跨消息选区会显示提示，而不是伪造来源。
- **键盘与主题**：工具条可通过 Tab 到达，Enter/Space 触发，Esc 关闭；使用 DSH 主题变量并遵循 `prefers-reduced-motion`。
- **中英双语**：跟随 DSH 界面语言。
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

- 引用一段文字：划选后点击 **引用**（或 Tab 聚焦工具条后按 Enter）。
- 关闭工具条：点击别处、滚动、按 Esc，或点击关闭按钮。
- 回到来源：点击输入框里的引用 chip，或已发送消息中的引用卡片。若消息尚未加载，插件会先加载更早的历史页（最多 8 页）。
- 输入框正在提交时不会插入引用，并会给出提示。

## 开发

```sh
pnpm install
pnpm build    # esbuild -> lib/index.js + lib/client.js
pnpm test     # vitest（离线；组件测试使用 jsdom）
```

仓库结构：

```text
src/index.ts             Host 半（纯客户端插件，apply 为空）
src/client/              选区观察、格式化、chip/卡片、工具条
tests/                   Vitest 测试
scripts/build-client.mjs esbuild 打包，同时设定 client 模块 id
lib/                     构建产物（已提交，随 npm 包发布）
```

**类型检查**在 DSH 源码树内完成。本仓库有意省略了 `tsconfig.json` 中指向 `deepseek-harness/...` 的 `paths` 映射，因为这些相对路径在独立仓库中不存在。发布版 `tsconfig.json` 保留编辑器所需的编译选项；完整的 `tsc --noEmit` 检查请在 DSH 源码树内使用原始 tsconfig 运行。

客户端 bundle 是 `window.__ModuleLoader__.load({ id, factory })` 注册，其中 `id` 必须等于包名，因此 `scripts/build-client.mjs` 中设置 `PLUGIN_ID = '@lifenrir/dsh-selection-quote'`。

## 工作原理

- session 作用域的观察者监听指针与选区变化，确认两个端点属于同一条消息，并把快照发布到 root 作用域的小型 dock。
- root 作用域的工具条定位在选区上方，通过 DSH 的引用 chip 插入路径写入引用。
- 已发送消息经 user-text 规则识别引用定界符并渲染为卡片；chip 与卡片都可以定位回来源消息。
- 所有注册都经过 `ctx.effect()` 或 slot 注入；插件不新增 Host 路由，也没有运行时依赖。

## 已知限制

- 选区依赖指针操作；触摸端长按不做特殊处理，只保留原生选择菜单。
- 选区必须位于同一条消息内。
- 回到来源用引用正文做纯文本匹配。首行含 `**` 等 Markdown 标记时可能匹配失败，此时提示来源消息未加载，而不是跳转。
- 若锚点节点被替换而浏览器未触发 `selectionchange`，工具条可能保留到下一次交互；插入仍会被安全拒绝。
- 只能引用消息正文；工具结果与思维链内容不参与划选。
- 引用长度上限为 4000 码点；不提供引用历史管理，也不支持“引用到新会话”。

## 许可证

MIT，见 [LICENSE](LICENSE)。
