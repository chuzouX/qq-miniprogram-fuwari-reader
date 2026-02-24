Page({
  data: {
    articles: [],
    filteredArticles: [],
    searchQuery: "",
    loading: true,
    blogUrl: "https://chuzoux.top",
    isDarkMode: false
  },

  rawXml: "",

  onLoad: function() {
    this.setData({
      isDarkMode: getApp().globalData.isDarkMode
    });
    this.fetchArticles();
  },

  onShow: function() {
    // 每次显示页面时检查一遍主题，防止跨时段切换
    const isDark = getApp().checkTheme();
    if (isDark !== this.data.isDarkMode) {
      this.setData({ isDarkMode: isDark });
    }
  },

  fetchArticles: function() {
    const that = this;
    qq.request({
      url: 'https://chuzoux.top/rss.xml',
      method: 'GET',
      dataType: 'text',
      success: function(res) {
        if (res.statusCode === 200) {
          that.rawXml = res.data;
          const articles = that.parseRSSList(res.data);
          that.setData({
            articles: articles,
            filteredArticles: articles,
            loading: false
          });
        } else {
          that.setData({ loading: false });
        }
      },
      fail: function() {
        qq.showToast({ title: '列表加载失败', icon: 'none' });
        that.setData({ loading: false });
      }
    });
  },

  parseRSSList: function(xml) {
    const items = [];
    const itemReg = /<item>([\s\S]*?)<\/item>/g;
    let match;
    
    while ((match = itemReg.exec(xml)) !== null) {
      const content = match[1];
      const title = this.extractTag(content, 'title');
      const link = this.extractTag(content, 'link');
      const pubDate = this.extractTag(content, 'pubDate');
      
      // 提取封面图 (通常在 description 或 content 中，或者特定的 image 标签)
      let cover = "";
      const imgMatch = content.match(/<img[^>]*src=["']([^"']+)["'][^>]*>/i);
      if (imgMatch) {
        cover = imgMatch[1];
        if (cover.startsWith('/')) {
          cover = "https://chuzoux.top" + cover;
        }
      }

      let dateStr = "";
      if (pubDate) {
        const date = new Date(pubDate);
        dateStr = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
      }

      items.push({
        title: title || "无标题",
        link: link || "",
        date: dateStr,
        cover: cover
      });
    }
    return items;
  },

  extractTag: function(xml, tag) {
    const tagName = tag.replace(':', '\\:');
    const reg = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`);
    const match = xml.match(reg);
    return match ? match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim() : "";
  },

  onSearchInput: function(e) {
    const query = e.detail.value.toLowerCase();
    const filtered = this.data.articles.filter(article => 
      article.title.toLowerCase().indexOf(query) !== -1
    );
    this.setData({
      searchQuery: query,
      filteredArticles: filtered
    });
  },

  clearSearch: function() {
    this.setData({
      searchQuery: "",
      filteredArticles: this.data.articles
    });
  },

  goToArticle: function(e) {
    const index = e.currentTarget.dataset.index;
    const articleSummary = this.data.filteredArticles[index];
    
    if (!articleSummary) return;

    const content = this.extractArticleContent(articleSummary.link);
    const fullArticle = {
      ...articleSummary,
      content: content
    };

    const app = getApp();
    if (app && app.globalData) {
      app.globalData.currentArticle = fullArticle;
    }

    // 使用相对路径跳转，并增加错误处理
    qq.navigateTo({
      url: '../article/article',
      fail: function(err) {
        console.error('跳转失败：', err);
        qq.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  },

  extractArticleContent: function(link) {
    if (!this.rawXml) return "";
    
    // 1. 将 XML 分割成独立的 <item> 数组
    const items = this.rawXml.match(/<item>[\s\S]*?<\/item>/g);
    if (!items) return "";

    // 2. 遍历 item，找到 link 完全匹配的那一个
    for (const itemXml of items) {
      const itemLink = this.extractTag(itemXml, 'link');
      if (itemLink === link) {
        const description = this.extractTag(itemXml, 'description');
        const encodedContent = this.extractTag(itemXml, 'content:encoded');
        return encodedContent || description;
      }
    }
    return "";
  },

  copyLink: function(e) {
    const url = e.currentTarget.dataset.url || this.data.blogUrl;
    qq.setClipboardData({
      data: url,
      success: function() {
        qq.showToast({
          title: '链接已复制',
          icon: 'success'
        });
      }
    });
  },

  onShareAppMessage: function() {
    return {
      title: "chuzouX's Blog",
      path: "/pages/index/index"
    };
  }
});