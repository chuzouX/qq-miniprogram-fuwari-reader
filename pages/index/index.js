const { trackEvent } = require('../../utils/umami.js');

Page({
  data: {
    allArticles: [],
    displayArticles: [],
    searchQuery: "",
    loading: true,
    blogUrl: "https://chuzoux.top",
    isDarkMode: false,
    currentPage: 1,
    pageSize: 10,
    totalPages: 1
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
            allArticles: articles,
            loading: false
          });
          that.updateDisplay();
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

  updateDisplay: function(targetPage) {
    const { allArticles, searchQuery, pageSize } = this.data;
    // 如果没有传入 targetPage，则使用当前的 currentPage
    let page = targetPage !== undefined ? targetPage : this.data.currentPage;
    
    // 1. 筛选
    const filtered = allArticles.filter(article => 
      article.title.toLowerCase().indexOf(searchQuery) !== -1
    );

    // 2. 计算分页
    const totalPages = Math.ceil(filtered.length / pageSize) || 1;
    
    // 确保 page 有效
    if (page > totalPages) page = totalPages;
    if (page < 1) page = 1;

    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const displayArticles = filtered.slice(start, end);

    this.setData({
      displayArticles: displayArticles,
      totalPages: totalPages,
      currentPage: page
    });
  },

  prevPage: function() {
    if (this.data.currentPage > 1) {
      this.updateDisplay(this.data.currentPage - 1);
      // 翻页后回到列表顶部
      qq.pageScrollTo({
        scrollTop: 0,
        duration: 300
      });
    }
  },

  nextPage: function() {
    if (this.data.currentPage < this.data.totalPages) {
      this.updateDisplay(this.data.currentPage + 1);
      qq.pageScrollTo({
        scrollTop: 0,
        duration: 300
      });
    }
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
    this.setData({
      searchQuery: query
    }, () => {
      this.updateDisplay(1);
    });
  },

  clearSearch: function() {
    this.setData({
      searchQuery: ""
    }, () => {
      this.updateDisplay(1);
    });
  },

  goToArticle: function(e) {
    const index = e.currentTarget.dataset.index;
    // 确保 index 是数字且有效
    if (typeof index !== 'number' || index < 0 || index >= this.data.displayArticles.length) {
      console.error('无效的索引：', index);
      return;
    }

    const articleSummary = this.data.displayArticles[index];
    
    if (!articleSummary) {
      console.error('未找到文章摘要，索引：', index);
      return;
    }

    console.log('跳转文章：', articleSummary.title, '链接：', articleSummary.link);

    // 埋点统计
    trackEvent('view_article', {
      title: articleSummary.title,
      link: articleSummary.link
    });

    const content = this.extractArticleContent(articleSummary.link);
    
    if (!content) {
      console.warn('文章内容为空，尝试使用描述或占位符');
    }

    const fullArticle = {
      ...articleSummary,
      content: content || "<p>暂无内容</p>" // 提供默认内容防止空白
    };

    const app = getApp();
    if (app && app.globalData) {
      app.globalData.currentArticle = fullArticle;
    }

    qq.navigateTo({
      url: '/pages/article/article',
      fail: function(err) {
        console.error('跳转失败：', err);
        qq.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  },

  copyLinkFromList: function(e) {
    // 阻止冒泡，避免触发跳转
    const index = e.currentTarget.dataset.index;
    const article = this.data.displayArticles[index];
    if (article && article.link) {
      qq.setClipboardData({
        data: article.link,
        success: function() {
          qq.showToast({
            title: '链接已复制',
            icon: 'success'
          });
        }
      });
    }
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