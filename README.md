## 项目简介

这是一个为个人博客 **chuzouX's Blog (`https://chuzoux.top`)** 编写的 **QQ 小程序客户端**。  
小程序通过请求博客的 `RSS` 源（`https://chuzoux.top/rss.xml`），在 QQ 小程序内展示文章列表，并提供文章详情阅读、搜索、复制链接等能力，相当于给博客做了一个原生风格的 QQ 入口。

## 功能特性

- **文章列表**
  - 从 `https://chuzoux.top/rss.xml` 拉取最新文章数据
  - 显示标题、发布日期
  - 支持按标题关键字搜索与清空搜索
- **文章详情**
  - 支持展示正文 HTML（含代码块、图片、提示块等常见 Fuwari/Fuwari-like Markdown 格式）
  - 提取文章封面图，展示文章头图和元信息
  - 图片点击可预览
  - 处理内部锚点（`#heading`）跳转，支持目录/锚点链接
- **主题与适配**
  - 根据时间（晚上 19:00 至早上 6:00）自动切换深色模式
  - 根据系统信息自适配状态栏高度和自定义导航栏高度（iOS/Android）
- **社交与链接**
  - 主页展示头像与个人简介
  - 提供 B 站、GitHub、邮箱等快捷复制入口
  - 支持复制博客首页链接、复制原文链接
- **分享**
  - 支持 QQ 小程序内转发分享，标题为 `"chuzouX's Blog"`，入口为首页

## 技术栈与运行环境

- **平台**：QQ 小程序
- **主要技术点**：
  - QQ 小程序页面/组件体系（`app.json`、`pages/*`）
  - `qq.request` 拉取 RSS 文本并用正则解析
  - 使用 `rich-text` + 自定义 HTML 预处理渲染博客内容
  - 通过 `getSystemInfoSync` 适配状态栏与自定义导航栏

推荐使用最新版的 **QQ 小程序开发者工具** 打开本项目进行开发与调试。

## 目录结构

```text
qq/
├─ app.js                # 小程序入口，初始化主题与系统信息
├─ app.json              # 全局配置（页面路由、导航栏标题等）
├─ app.qss               # 全局样式
├─ project.config.json   # 开发者工具项目配置
├─ sitemap.json          # 小程序页面 sitemap
├─ icons/                # 图标资源（GitHub/Bilibili/Email/返回等）
├─ utils/
│  └─ util.js            # 通用时间格式化工具（目前使用较少）
└─ pages/
   ├─ index/             # 首页：文章列表 + 搜索 + 社交链接
   │  ├─ index.js
   │  ├─ index.json
   │  ├─ index.qml
   │  └─ index.qss
   └─ article/           # 文章详情页：正文渲染 + 图片预览 + 复制原文链接
      ├─ article.js
      ├─ article.json
      ├─ article.qml
      └─ article.qss
```

## 关键页面说明

### 首页 `pages/index/index`

- 从 `https://chuzoux.top/rss.xml` 加载博客 RSS：
  - 使用 `qq.request` 请求 XML 文本
  - 通过正则匹配 `<item>`，提取 `title` / `link` / `pubDate` 等字段
  - 尝试从 `<img>` 标签中识别封面图，自动补全相对路径为 `https://chuzoux.top/...`
- 支持搜索：
  - 输入框 `bindinput="onSearchInput"`，对标题做本地模糊匹配
  - 清空按钮 `clearSearch` 恢复完整列表
- 点击文章：
  - 在内存中根据 `link` 从原始 XML 中找到对应 `<item>`，读取 `content:encoded` 或 `description` 作为全文 HTML
  - 把文章摘要 + 正文缓存到 `getApp().globalData.currentArticle`
  - 通过 `qq.navigateTo('../article/article')` 跳转到详情页
- 主页顶部展示头像、个人简介以及社交图标，点击图标会调用 `copyLink` 把对应地址复制到剪贴板。

### 文章详情页 `pages/article/article`

- 从 `globalData.currentArticle` 中读取当前文章信息并渲染：
  - 标题、日期、作者（固定为 `chuzouX`）、封面图
  - 正文 HTML 字符串
- 对 Fuwari/Markdown 导出的 HTML 做多步预处理：
  - 解码 HTML 实体、移除 `<script>` 标签
  - 抽取 `<pre><code>` 代码块与行内 `<code>`，用占位符保护，再转成适合小程序渲染的 HTML，并生成「复制」按钮
  - 处理图片链接为完整 `https://chuzoux.top/...` URL，并加上适配小程序的内联样式
  - 处理表格、GitHub 卡片、提示块（note/tip/important/warning/caution）等自定义格式
  - 给标题添加锚点 id，支持目录/锚点跳转
- 将处理结果切分成多个 `segments`：
  - `type: "html"` 片段由 `rich-text` 渲染
  - `type: "img"` 片段用 `<image>` 渲染，可点击预览
- 链接处理：
  - 内部锚点（`#xxx`）通过 `pageScrollTo` 精准滚动到对应位置
  - 非锚点链接默认复制到剪贴板，并给出 Toast 提示

## 本地开发与预览

1. **导入项目**
   - 打开 QQ 小程序开发者工具
   - 选择「导入项目」，目录指向本仓库根目录（包含 `app.json` 的这一层）
   - 填写/选择你自己的 QQ 小程序 `AppID`

2. **配置基础信息**
   - 在 QQ 小程序管理后台配置：  
     - 小程序名称（例如：`chuzouX 博客`）
     - 图标、简介等
   - 若后续要使用网络请求/业务域名能力，按平台要求配置可信域名（如 `https://chuzoux.top`）

3. **运行与调试**
   - 在开发者工具中点击「编译」，即可在模拟器中看到首页
   - 使用「预览」扫码，可在手机 QQ 内真机调试
   - 可以在控制台查看网络请求（确认成功访问 `https://chuzoux.top/rss.xml`）与日志输出

## 发布上线（简要流程）

1. 在 QQ 小程序管理后台完善小程序信息与类目。
2. 在开发者工具中上传代码版本。
3. 在后台创建并提交审核版本（一般可将功能描述为「博客 RSS 阅读小程序」）。
4. 审核通过后发布，即可通过 QQ 搜索或分享卡片访问。

## 注意事项

- **RSS 可用性**：本小程序依赖 `https://chuzoux.top/rss.xml`，请确保博客端开启并保持 RSS 正常输出。
- **RSS 兼容性**：当前的 RSS 解析逻辑是基于 Fuwari 框架博客的 RSS 输出格式设计的，理论上适用于其他使用 Fuwari 框架的博客（字段结构相近的 RSS 源）。如用于非 Fuwari 博客，请自行根据实际 RSS 结构调整解析代码。
- **网络配置**：如遇到真机请求失败，需检查 QQ 小程序后台的「服务器域名 / 业务域名」配置中是否包含 `https://chuzoux.top`。
- **内容兼容性**：极少数复杂 Markdown / HTML 语法可能无法在 QQ 小程序内 100% 还原，详情页已有基础的兼容处理，可视需求继续增强。
- **使用限制**：本项目仅供作者本人个人使用与学习交流，不保证长期维护或对外可用性。如需自行使用或上线，请根据自身需求对代码进行必要修改和适配，并自行承担由此产生的一切责任。

