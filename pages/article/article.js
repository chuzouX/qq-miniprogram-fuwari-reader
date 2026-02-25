Page({
  data: {
    article: {},
    isDarkMode: false,
    statusBarHeight: 20,
    navBarHeight: 44
  },

  onLoad: function() {
    const app = getApp();
    if (!app || !app.globalData) {
      console.error('App instance or globalData is missing');
      return;
    }
    this.setData({
      isDarkMode: app.globalData.isDarkMode || false,
      statusBarHeight: app.globalData.statusBarHeight || 20,
      navBarHeight: app.globalData.navBarHeight || 44
    });
    const article = app.globalData.currentArticle;
    if (article) {
      let content = article.content || "";
      
      // Calculate reading stats
      const { wordCount, readingTime } = this.calculateReadingStats(content);

      this.setData({
        article: {
          ...article,
          title: article.title || "",
          date: article.date || "",
          cover: article.cover || "",
          link: article.link || "",
          wordCount,
          readingTime
        }
      });
      
      // 1. 基础预处理
      content = this.decodeHtmlEntities(content);
      content = content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
      
      // 2. 提取并保护代码块（最优先保护，防止后续正则干扰）
      const { content: contentWithPlaceholders, placeholders } = this.extractCodeBlocks(content);
      content = contentWithPlaceholders;
      this.codePlaceholders = placeholders;
      
      // 3. 处理图片路径（在占位符状态下处理，确保不误伤代码中的图片链接）
      const blogBase = "https://chuzoux.top";
      content = content.replace(/<img\s+[^>]*src=["']([^"']+)["'][^>]*\/?>/gi, (match, src) => {
        let fullSrc = src;
        if (src.startsWith('../assets/images/')) {
          fullSrc = blogBase + '/' + src.replace(/^\.\.\//, '');
        } else if (src.startsWith('/')) {
          fullSrc = blogBase + src;
        } else if (!src.startsWith('http')) {
          fullSrc = blogBase + '/' + src;
        }
        return `<img src="${fullSrc}" style="max-width:100%;height:auto;display:block;margin:10px 0;border-radius:8px;" />`;
      });

      content = content.replace(/<table/gi, '<table class="md-table"');

      content = this.processFuwariTags(content);
      content = this.addHeadingAnchors(content); // 移到 processFuwariTags 之后，extractCodeBlocks 之后
      content = this.convertLinks(content);
      
      // 保存处理后的内容（含占位符），以便主题切换时重新渲染数学公式
      this.processedHtmlWithPlaceholders = content;
      
      this.renderFullContent(getApp().globalData.isDarkMode);
      
      qq.setNavigationBarTitle({
        title: article.title
      });
    } else {
      qq.showToast({
        title: '文章加载失败',
        icon: 'none'
      });
      setTimeout(() => {
        qq.navigateBack();
      }, 1500);
    }
  },

  parseSegments: function(html) {
    const segments = [];
    // 匹配 img 标签，捕获 src 和整个标签以检查 class
    const imgReg = /<img\s+([^>]*src=["']([^"']+)["'][^>]*)>/gi;
    let lastIndex = 0;
    let match;
    const imgUrls = [];

    while ((match = imgReg.exec(html)) !== null) {
      const fullTag = match[0];
      const attrs = match[1];
      const src = match[2];
      const isMath = fullTag.indexOf('math-img') > -1;

      // 1. 添加图片之前的 HTML 片段
      if (match.index > lastIndex) {
        segments.push({
          type: 'html',
          content: html.substring(lastIndex, match.index)
        });
      }
      
      // 2. 添加图片片段
      if (!isMath) {
        imgUrls.push(src);
      }
      
      segments.push({
        type: 'img',
        src: src,
        isMath: isMath
      });
      
      lastIndex = imgReg.lastIndex;
    }

    // 3. 添加剩余的 HTML 片段
    if (lastIndex < html.length) {
      segments.push({
        type: 'html',
        content: html.substring(lastIndex)
      });
    }

    this.imgUrls = imgUrls; // 存储所有图片用于预览
    return segments.length > 0 ? segments : [{ type: 'html', content: html }];
  },

  onShow: function() {
    // 确保进入页面时导航栏颜色与主题一致
    const isDark = getApp().checkTheme();
    if (isDark !== this.data.isDarkMode) {
      this.setData({ isDarkMode: isDark });
      // 如果主题发生变化，重新渲染包含数学公式的内容
      if (this.processedHtmlWithPlaceholders) {
        this.renderFullContent(isDark);
      }
    }
  },

  previewSingleImage: function(e) {
    const current = e.currentTarget.dataset.src;
    qq.previewImage({
      urls: this.imgUrls,
      current: current
    });
  },

  handleLinkTap: function(e) {
    const href = (e.detail && e.detail.href) ? e.detail.href : "";
    this.handleHref(href);
  },

  handleRichTextTap: function(e) {
    const dataset = e && e.target ? e.target.dataset : null;
    const dataUrl = dataset && dataset.url ? dataset.url : "";
    if (dataUrl) {
      const decoded = this.safeDecode(dataUrl);
      this.copyText(decoded);
      return;
    }
    this.handleHref("");
  },

  handleHref: function(href) {
    if (!href) return;
    const normalizedHref = this.decodeHtmlEntities(href);
    if (this.isAnchorLink(normalizedHref)) {
      const anchor = this.getAnchorId(normalizedHref);
      if (anchor) {
        this.scrollToAnchor(anchor);
      }
      return;
    }
    this.copyText(normalizedHref);
  },

  copyText: function(text) {
    if (!text) return;
    qq.setClipboardData({
      data: text,
      success: function() {
        qq.showToast({
          title: '已复制',
          icon: 'success'
        });
      }
    });
  },

  safeEncode: function(text) {
    try {
      return encodeURIComponent(text || "");
    } catch (e) {
      return text || "";
    }
  },

  safeDecode: function(text) {
    try {
      return decodeURIComponent(text || "");
    } catch (e) {
      return text || "";
    }
  },

  isAnchorLink: function(href) {
    if (href.startsWith("#")) return true;
    const base = (this.data.article && this.data.article.link) ? this.data.article.link : "";
    if (!base) return false;
    const hashIndex = href.indexOf("#");
    if (hashIndex === -1) return false;
    const pure = href.slice(0, hashIndex);
    return this.normalizeUrl(pure) === this.normalizeUrl(base);
  },

  getAnchorId: function(href) {
    const hashIndex = href.indexOf("#");
    if (hashIndex === -1) return "";
    const raw = href.slice(hashIndex + 1);
    try {
      return decodeURIComponent(raw);
    } catch (e) {
      return raw;
    }
  },

  scrollToAnchor: function(anchorId) {
    const selector = `#${anchorId}`;
    const query = qq.createSelectorQuery();
    query.select(selector).boundingClientRect();
    query.selectViewport().scrollOffset();
    query.exec(res => {
      const rect = res && res[0];
      const scroll = res && res[1];
      if (!rect || !scroll) return;
      const topOffset = this.data.statusBarHeight + this.data.navBarHeight + 12;
      const target = rect.top + scroll.scrollTop - topOffset;
      qq.pageScrollTo({
        scrollTop: target < 0 ? 0 : target,
        duration: 300
      });
    });
  },

  goBack: function() {
    qq.navigateBack();
  },

  extractCodeBlocks: function(content) {
    const placeholders = [];
    
    content = content.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (match, inner) => {
      const codeMatch = inner.match(/<code[^>]*>([\s\S]*?)<\/code>/i);
      const codeContent = codeMatch ? codeMatch[1] : inner;
      
      const id = `__BLOCK_CODE_${placeholders.length}__`;
      const safeCode = this.formatCodeHtml(codeContent);
      const rawCode = this.safeDecode(codeContent); // 应该存储解码后的原始内容
      
      placeholders.push({
        id: id,
        type: 'block',
        codeHtml: `<span class="md-code">${safeCode}</span>`, // 保持结构
        rawCode: rawCode
      });
      return id;
    });
    
    content = content.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (match, inner) => {
      const id = `__INLINE_CODE_${placeholders.length}__`;
      const safeCode = this.escapeHtml(inner);
      placeholders.push({
        id: id,
        type: 'inline',
        html: `<span class="md-code-inline">${safeCode}</span>`
      });
      return id;
    });
    
    return { content, placeholders };
  },

  escapeHtml: function(text) {
    return (text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  },

  formatCodeHtml: function(code) {
    const normalized = (code || "").replace(/\r\n/g, "\n").replace(/\t/g, "  ");
    const escaped = this.escapeHtml(normalized);
    const lines = escaped.split("\n");
    const formatted = lines.map(line => {
      const leading = line.match(/^ +/);
      if (!leading) return line;
      const prefix = "&nbsp;".repeat(leading[0].length);
      return prefix + line.slice(leading[0].length);
    });
    return formatted.join("<br/>");
  },

  addHeadingAnchors: function(html) {
    if (!html) return "";
    
    if (!this.headingPlaceholders) this.headingPlaceholders = [];
    const used = {};
    
    return html.replace(/<h([1-6])([^>]*)>([\s\S]*?)<\/h\1>/gi, (match, level, attrs, inner) => {
      const hasId = /\sid=["']([^"']+)["']/.exec(attrs);
      const existingId = hasId ? hasId[1] : "";
      
      // 这里的 inner 可能包含代码块占位符，需要小心处理
      // 暂时直接用 inner 计算 ID，假设占位符不影响 ID 的唯一性太大，或者占位符本身是稳定的
      const text = inner.replace(/<[^>]+>/g, "").trim();
      let anchorId = existingId || this.buildAnchorId(text);
      
      if (!anchorId) {
        return match;
      }
      
      const base = anchorId;
      let count = used[base] || 0;
      if (count > 0) {
        anchorId = `${base}-${count}`;
      }
      used[base] = count + 1;
      
      // 生成 compactId (兼容旧逻辑)
      const compactId = anchorId.replace(/-(?=[\u4e00-\u9fff])/g, "");
      const finalCompactId = (compactId && compactId !== anchorId) ? compactId : null;
      
      // 创建占位符
      const id = `__BLOCK_HEADING_${this.headingPlaceholders.length}__`;
      this.headingPlaceholders.push({
        id: id,
        type: 'heading',
        level: level,
        anchorId: anchorId,
        compactId: finalCompactId,
        html: `<h${level}${attrs}>${inner}</h${level}>` // 保留原始 HTML 用于渲染
      });
      
      return id;
    });
  },

  buildAnchorId: function(text) {
    if (!text) return "";
    const normalized = text.trim().toLowerCase().replace(/\s+/g, "-");
    const cleaned = normalized.replace(/[^\w\u4e00-\u9fff\-]/g, "");
    return cleaned || normalized;
  },

  normalizeUrl: function(url) {
    if (!url) return "";
    return url.replace(/\/$/, "");
  },

  convertLinks: function(html) {
    if (!html) return "";
    // 优化正则，支持属性间任意空白，捕获 href 值
    return html.replace(/<a\s+([^>]*?)\bhref=["']([^"']*)["']([^>]*)>/gi, (match, before, href, after) => {
      // 合并前后属性
      const attrs = `${before} ${after}`.replace(/\s+/g, " ").trim();
      
      // 处理 class
      const classMatch = attrs.match(/class=["']([^"']*)["']/i);
      let newAttrs = attrs;
      if (classMatch) {
        const merged = `${classMatch[1]} md-link`.replace(/\s+/g, " ").trim();
        newAttrs = newAttrs.replace(/class=["']([^"']*)["']/i, `class="${merged}"`);
      } else {
        newAttrs = `${newAttrs} class="md-link"`.trim();
      }
      
      // 确保 data-url 存在（虽然 bindlinktap 主要依赖 href，但保留以防万一）
      if (!/data-url=/i.test(newAttrs)) {
        newAttrs = `${newAttrs} data-url="${this.escapeHtml(href)}"`.trim();
      }
      
      // 重建标签，确保 href 存在且正确
      return `<a href="${href}" ${newAttrs}>`;
    });
  },

  processFuwariTags: function(html) {
    if (!html) return "";
    let result = html;
    
    // 初始化 githubPlaceholders
    if (!this.githubPlaceholders) this.githubPlaceholders = [];

    result = result.replace(/::github\s*\{\s*repo\s*=\s*["']([^"']+)["']\s*\}/gi, (match, repo) => {
      const safeRepo = this.escapeHtml(repo.trim());
      const link = `https://github.com/${repo.trim()}`;
      
      const id = `__BLOCK_GITHUB_${this.githubPlaceholders.length}__`;
      this.githubPlaceholders.push({
        id: id,
        type: 'github',
        repo: safeRepo,
        link: link
      });
      return id;
    });

    result = result.replace(/:::\s*(note|tip|important|warning|caution)(?:\[(.*?)\])?\s*([\s\S]*?):::/gi, (match, type, title, body) => {
      const kind = String(type || "").toLowerCase();
      const label = (title && title.trim()) ? title.trim() : kind.toUpperCase();
      const content = body ? body.trim() : "";
      const contentHtml = content.indexOf("<") >= 0
        ? content
        : this.escapeHtml(content).replace(/\n{2,}/g, "<br/><br/>").replace(/\n/g, "<br/>");
      return `<div class="admonition admonition-${kind}"><div class="admonition-title">${this.escapeHtml(label)}</div><div class="admonition-content">${contentHtml}</div></div>`;
    });

    result = result.replace(/<blockquote>([\s\S]*?)<\/blockquote>/gi, (match, inner) => {
      const marker = inner.match(/\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i);
      if (!marker) return match;
      const kind = marker[1].toLowerCase();
      const cleaned = inner.replace(/\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i, "").trim();
      const contentHtml = cleaned.trim() ? cleaned : "";
      return `<div class="admonition admonition-${kind}"><div class="admonition-title">${marker[1]}</div><div class="admonition-content">${contentHtml}</div></div>`;
    });

    return result;
  },

  restoreCodeBlocks: function(html) {
    if (!html || !this.codePlaceholders) return html;
    let result = html;
    this.codePlaceholders.forEach(item => {
      // 只恢复内联代码，块级代码保留占位符
      if (item.type === 'inline') {
        result = result.split(item.id).join(item.html);
      }
    });
    return result;
  },

  expandSegments: function(segments) {
    if (!segments || segments.length === 0) return [];
    
    let result = [];
    segments.forEach(seg => {
      if (seg.type !== 'html') {
        result.push(seg);
        return;
      }

      // 处理 HTML 片段中的块级代码占位符、Github 卡片占位符、标题占位符、包含链接的段落以及列表
      // 使用 split 保留分隔符，并处理可能的空字符串
      // 注意：这里使用 [\s\S] 替代 . 以匹配包含换行的内容
      const parts = seg.content.split(/(__BLOCK_CODE_\d+__|__BLOCK_GITHUB_\d+__|__BLOCK_HEADING_\d+__|<p[^>]*>[\s\S]*?<a[^>]*>[\s\S]*?<\/a>[\s\S]*?<\/p>|<[uo]l[^>]*>[\s\S]*?<\/[uo]l>)/gi);
      
      parts.forEach(part => {
        if (!part) return;
        
        // 1. 代码块占位符
        let match = part.match(/^__BLOCK_CODE_(\d+)__$/);
        if (match) {
          const index = parseInt(match[1]);
          const placeholder = this.codePlaceholders[index];
          if (placeholder && placeholder.type === 'block') {
            result.push({
              type: 'code',
              codeHtml: placeholder.codeHtml,
              rawCode: placeholder.rawCode
            });
            return;
          }
        }
        
        // 2. Github 卡片占位符
        match = part.match(/^__BLOCK_GITHUB_(\d+)__$/);
        if (match) {
          const index = parseInt(match[1]);
          if (this.githubPlaceholders && this.githubPlaceholders[index]) {
            const github = this.githubPlaceholders[index];
            result.push({
              type: 'github',
              repo: github.repo,
              link: github.link
            });
            return;
          }
        }

        // 3. 标题占位符
        match = part.match(/^__BLOCK_HEADING_(\d+)__$/);
        if (match) {
          const index = parseInt(match[1]);
          if (this.headingPlaceholders && this.headingPlaceholders[index]) {
            const heading = this.headingPlaceholders[index];
            // 标题内部可能包含内联代码占位符，需要恢复
            const restoredHtml = this.restoreCodeBlocks(heading.html);
            result.push({
              type: 'heading',
              html: restoredHtml,
              anchorId: heading.anchorId,
              compactId: heading.compactId
            });
            return;
          }
        }

        // 4. 列表 (ul/ol) -> 转换为原生 list 结构
        if (/^<[uo]l[^>]*>/i.test(part)) {
          const listData = this.parseList(part);
          if (listData) {
            result.push(listData);
            return;
          }
        }

        // 5. 包含链接的段落 -> 转换为原生 text 节点
        // 简单的检查是否是 <p> 包裹且包含 <a>
        if (/^<p[^>]*>[\s\S]*<a[^>]*>[\s\S]*<\/a>[\s\S]*<\/p>$/i.test(part)) {
          const innerMatch = part.match(/^<p[^>]*>([\s\S]*)<\/p>$/i);
          if (innerMatch) {
            const textNodes = this.parseTextNodes(innerMatch[1]);
            if (textNodes && textNodes.length > 0) {
              result.push({
                type: 'p-text',
                nodes: textNodes
              });
              return;
            }
          }
        }
        
        // 6. 普通 HTML 内容（包括不含链接的段落等）
        // 如果 part 只是空白字符，可以忽略（视情况而定，这里保留以防布局塌陷）
        if (part.trim() || part.indexOf('&nbsp;') > -1) {
           // 忽略未被解析的占位符，防止它们显示在页面上
           if (/^__BLOCK_(HEADING|CODE|GITHUB)_\d+__$/.test(part.trim())) {
             return;
           }
           result.push({ type: 'html', content: part });
        }
      });
    });
    
    return result;
  },

  parseList: function(html) {
    if (!html) return null;
    
    // 简单的列表解析器，不支持复杂嵌套
    const tagMatch = html.match(/^<([uo]l)([^>]*)>/i);
    const tag = tagMatch ? tagMatch[1].toLowerCase() : 'ul';
    const attrs = tagMatch ? tagMatch[2] : '';
    
    // 获取有序列表起始序号
    let start = 1;
    if (tag === 'ol') {
      const startMatch = attrs.match(/start=["']?(\d+)["']?/i);
      if (startMatch) {
        start = parseInt(startMatch[1], 10);
      }
    }

    const items = [];
    
    // 提取 li 内容
    const liReg = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let match;
    while ((match = liReg.exec(html)) !== null) {
      // 这里的 content 可能包含内联代码占位符，需要先恢复
      // 但 parseTextNodes 本身不支持占位符，所以我们需要先恢复内联代码
      let content = match[1];
      content = this.restoreCodeBlocks(content);
      
      items.push({
        nodes: this.parseTextNodes(content)
      });
    }
    
    if (items.length > 0) {
      return {
        type: 'list',
        tag: tag,
        start: start,
        items: items
      };
    }
    return null;
  },

  parseTextNodes: function(html) {
    if (!html) return [];
    
    // 简单的标签解析器，支持 a, strong, b, em, i, code, br
    // 将 HTML 字符串解析为节点数组
    const nodes = [];
    const tagReg = /<(\/?)(\w+)([^>]*)>|([^<]+)/g;
    let match;
    let currentStyle = {
      bold: false,
      italic: false,
      code: false,
      link: null // { href: '' }
    };
    
    // 辅助栈，用于处理嵌套（简单处理，不支持复杂嵌套恢复）
    // 实际上由于小程序 text 嵌套支持有限，这里采用扁平化策略：
    // 每段文本都带有当前的所有样式状态
    
    while ((match = tagReg.exec(html)) !== null) {
      if (match[4]) {
        // 文本节点
        const text = this.decodeHtmlEntities(match[4]);
        nodes.push({
          type: 'text',
          text: text,
          ...currentStyle
        });
      } else {
        // 标签节点
        const isClose = match[1] === '/';
        const tagName = match[2].toLowerCase();
        const attrs = match[3];
        
        if (tagName === 'br') {
          nodes.push({ type: 'br' });
          continue;
        }
        
        if (tagName === 'strong' || tagName === 'b') {
          currentStyle.bold = !isClose;
        } else if (tagName === 'em' || tagName === 'i') {
          currentStyle.italic = !isClose;
        } else if (tagName === 'code') {
          currentStyle.code = !isClose;
        } else if (tagName === 'a') {
          if (!isClose) {
            const hrefMatch = attrs.match(/href=["']([^"']*)["']/i);
            currentStyle.link = hrefMatch ? { href: hrefMatch[1] } : null;
          } else {
            currentStyle.link = null;
          }
        }
        // 忽略 span 等其他标签，但保留内容
      }
    }
    
    return nodes;
  },

  renderFullContent: function(isDark) {
    // 基于带占位符的 HTML 进行渲染
    const contentWithMath = this.renderMath(this.processedHtmlWithPlaceholders, isDark);
    const segments = this.parseSegments(contentWithMath);
    
    // 在每个 HTML 段落中还原内联代码块，保留块级代码占位符
    const partiallyRestoredSegments = segments.map(seg => {
      if (seg.type === 'html') {
        return { ...seg, content: this.restoreCodeBlocks(seg.content) };
      }
      return seg;
    });

    // 展开块级代码和 Github 卡片为独立 segment
    const finalSegments = this.expandSegments(partiallyRestoredSegments);

    this.setData({
      'article.segments': finalSegments
    });
  },

  copyCode: function(e) {
    const code = e.currentTarget.dataset.code;
    if (code) {
      this.copyText(code);
    }
  },

  handleTextLinkTap: function(e) {
    const href = e.currentTarget.dataset.code;
    this.handleHref(href);
  },

  renderMath: function(html, isDark) {
    if (!html) return "";

    // 此时 html 中已经没有 pre/code 标签了，只有占位符，所以可以直接处理数学公式
    let tempHtml = html;
    const mathApi = "https://latex.codecogs.com/svg.image?";
    const darkMathApi = "https://latex.codecogs.com/svg.image?\\color{white}";

    // 1. 处理块级公式 $$ ... $$
    tempHtml = tempHtml.replace(/\$\$\s*([\s\S]*?)\s*\$\$/g, (match, latex) => {
      const encoded = encodeURIComponent(latex.trim());
      const api = isDark ? darkMathApi : mathApi;
      return `<div style="text-align:center; margin: 20px 0;"><img class="math-img" src="${api}${encoded}" style="max-width:90%; height:auto;" /></div>`;
    });

    // 2. 处理行内公式 $ ... $
    tempHtml = tempHtml.replace(/\$([^\s$][^$]*?[^\s$])\$/g, (match, latex) => {
      const encoded = encodeURIComponent(latex.trim());
      const api = isDark ? darkMathApi : mathApi;
      return `<img class="math-img" src="${api}${encoded}" style="vertical-align:middle; margin:0 4px; max-width:100%;" />`;
    });

    return tempHtml;
  },

  calculateReadingStats: function(html) {
    if (!html) return { wordCount: 0, readingTime: 0 };
    
    // Remove HTML tags and extra whitespace
    const plainText = html.replace(/<[^>]+>/g, "").replace(/\s+/g, "");
    const wordCount = plainText.length;
    
    // Average reading speed: 400 chars/min
    if (wordCount === 0) return { wordCount: 0, readingTime: 0 };
    const readingTime = Math.ceil(wordCount / 400) || 1;
    
    return { wordCount, readingTime };
  },

  decodeHtmlEntities: function(str) {
    if (!str) return "";
    return str
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/&mdash;/g, "—")
      .replace(/&ldquo;/g, "“")
      .replace(/&rdquo;/g, "”")
      .replace(/&hellip;/g, "…");
  },

  copyOriginalLink: function() {
    if (this.data.article.link) {
      qq.setClipboardData({
        data: this.data.article.link,
        success: function() {
          qq.showToast({
            title: '链接已复制',
            icon: 'success'
          });
        }
      });
    }
  },

  onShareAppMessage: function() {
    return {
      title: this.data.article.title || "chuzouX's Blog",
      path: '/pages/index/index'
    };
  }
});
