# Schema-Link-Messenger Blueprint v1.0

## 1. 愿景与核心逻辑 (Vision & Core Logic)
构建一个具有长期记忆、高度结构化的 URL 链接收集看板。前端纯原生，数据持久化完全依赖 GitHub API（将其作为免费的 Document DB 使用），并通过 Serverless 提供安全的跨域解析能力。

## 2. 原子化事实 (Atomic Facts)
- **架构**：采用 8 模块解耦架构 (Main, State, GitHubAPI, PreviewAPI, UI-Board, UI-Input, UI-Search, Utils)。
- **存储**：所有 Link 数据以 JSON 数组形式存储在指定的 GitHub Repository 的特定文件（如 `data/links.json`）中。
- **渲染**：分类卡片看板（Kanban），支持实时本地过滤搜索。

## 3. 约束条件 (Absolute Constraints)
- **严禁** 使用任何前端 UI 框架（React/Vue/Angular）或打包工具（Webpack/Vite），强制使用原生 ES Modules (`<script type="module">`)。
- **严禁** 在前端代码中硬编码 GitHub Personal Access Token (PAT)。
- **严禁** 直接在前端用 `fetch` 请求任意外部 URL 解析 HTML（必触发 CORS 拦截）。

## 4. 决策账本 (Decision Ledger)
- **选择 GitHub API 作为数据库**：
  - *Why?* 免费，自带版本控制（Commits），通过 SHA 和 Base64 编解码即可实现 CRUD，无需额外部署后端数据库。
- **选择原生 ES Modules (8模块解耦)**：
  - *Why?* 极简化开发，浏览器原生支持，符合长期维护和 AI 自动生成的单点修改原则，避免牵一发而动全身。

## 5. 核心难点：CORS 预览图解析“原子化方案”
**挑战**：浏览器安全策略禁止前端代码直接抓取非同源网站的 DOM（用于提取 `<title>` 和 `<meta property="og:image">`）。
**原子化绕过方案 (Serverless Edge Proxy)**：
1. **职责分离**：前端只负责发送带参数的 URL，绝不处理跨域 HTML。
2. **边缘代理 (Vercel Edge / Cloudflare Worker)**：
   - 创建一个极简的 Serverless API (`/api/parse?url=...`)。
   - Serverless 环境下不受 CORS 限制，利用标准的 `fetch` 获取目标页面的 HTML 文本。
   - 使用正则表达式匹配 `<title>(.*?)</title>` 和 `<meta property="og:image" content="(.*?)">`，提取出数据。
   - 设置 `Access-Control-Allow-Origin: *` 响应头，组装成标准的 JSON 返回给前端。
3. **安全闭环**：前端 `PreviewAPI` 模块只与我们自己的 Serverless URL 通信，彻底切断前端直接跨域的尝试。