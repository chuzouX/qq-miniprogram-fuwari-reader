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
      this.setData({
        article: {
          ...article,
          title: article.title || "",
          date: article.date || "",
          cover: article.cover || "",
          link: article.link || ""
        }
      });
      let content = article.content || "";
      
      // 1. 基础预处理
      content = this.decodeHtmlEntities(content);
      content = content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
      content = this.addHeadingAnchors(content);
      
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
      const rawCode = this.safeEncode(codeContent);
      placeholders.push({
        id: id,
        html: `<div class="md-pre"><span class="md-code">${safeCode}</span><span class="md-copy-btn" data-url="${rawCode}">复制</span></div>`
      });
      return id;
    });
    
    content = content.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (match, inner) => {
      const id = `__INLINE_CODE_${placeholders.length}__`;
      const safeCode = this.escapeHtml(inner);
      placeholders.push({
        id: id,
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
    const used = {};
    return html.replace(/<h([1-6])([^>]*)>([\s\S]*?)<\/h\1>/gi, (match, level, attrs, inner) => {
      const hasId = /\sid=["']([^"']+)["']/.exec(attrs);
      const existingId = hasId ? hasId[1] : "";
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
      const attrsWithId = existingId ? attrs : `${attrs} id="${anchorId}"`;
      const compactId = anchorId.replace(/-(?=[\u4e00-\u9fff])/g, "");
      const anchors = compactId && compactId !== anchorId
        ? `<span id="${anchorId}"></span><span id="${compactId}"></span>`
        : `<span id="${anchorId}"></span>`;
      return `${anchors}<h${level}${attrsWithId}>${inner}</h${level}>`;
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
    return html.replace(/<a\s+([^>]*?)href=["']([^"']+)["']([^>]*)>/gi, (match, before, href, after) => {
      const attrs = `${before} ${after}`.replace(/\s+/g, " ").trim();
      const classMatch = attrs.match(/class=["']([^"']*)["']/i);
      let newAttrs = attrs;
      if (classMatch) {
        const merged = `${classMatch[1]} md-link`.replace(/\s+/g, " ").trim();
        newAttrs = newAttrs.replace(/class=["']([^"']*)["']/i, `class="${merged}"`);
      } else {
        newAttrs = `${newAttrs} class="md-link"`.trim();
      }
      if (!/data-url=/i.test(newAttrs)) {
        newAttrs = `${newAttrs} data-url="${this.escapeHtml(href)}"`.trim();
      }
      return `<a href="${href}" ${newAttrs}>`;
    });
  },

  processFuwariTags: function(html) {
    if (!html) return "";
    let result = html;

    result = result.replace(/::github\s*\{\s*repo\s*=\s*["']([^"']+)["']\s*\}/gi, (match, repo) => {
      const safeRepo = this.escapeHtml(repo.trim());
      const link = `https://github.com/${repo.trim()}`;
      return `<div class="github-card"><div class="github-card-title">${safeRepo}</div><a class="github-card-link" href="${link}">${link}</a></div>`;
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
      // 使用 split/join 避免正则替换中的 $ 符号问题
      result = result.split(item.id).join(item.html);
    });
    return result;
  },

  renderFullContent: function(isDark) {
    // 基于带占位符的 HTML 进行渲染
    const contentWithMath = this.renderMath(this.processedHtmlWithPlaceholders, isDark);
    const segments = this.parseSegments(contentWithMath);
    
    // 在每个 HTML 段落中还原代码块
    const restoredSegments = segments.map(seg => {
      if (seg.type === 'html') {
        return { ...seg, content: this.restoreCodeBlocks(seg.content) };
      }
      return seg;
    });

    this.setData({
      'article.segments': restoredSegments
    });
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
