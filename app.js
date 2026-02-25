// app.js
require('./utils/umami.js');

App({
  onLaunch: function () {
    this.checkTheme();
    this.getSystemInfo();
  },
  getSystemInfo: function() {
    try {
      const info = qq.getSystemInfoSync();
      const menuButtonInfo = qq.getMenuButtonBoundingClientRect();
      
      if (info) {
        this.globalData.statusBarHeight = info.statusBarHeight || 20;
        
        let navBarHeight = 0;
        if (menuButtonInfo) {
          // 导航栏高度 = (胶囊按钮上边距 - 状态栏高度) * 2 + 胶囊按钮高度
          const gap = menuButtonInfo.top - this.globalData.statusBarHeight;
          navBarHeight = gap * 2 + menuButtonInfo.height;
        }
        
        if (!navBarHeight) {
          const system = info.system || '';
          navBarHeight = system.indexOf('iOS') > -1 ? 44 : 48;
        }
        
        this.globalData.navBarHeight = navBarHeight;
      }
    } catch (e) {
      console.error('获取系统信息失败', e);
      // 兜底策略
      this.globalData.statusBarHeight = 20;
      this.globalData.navBarHeight = 44;
    }
  },
  checkTheme: function() {
    const hour = new Date().getHours();
    // 晚上7点到早上6点为夜间模式
    const isDarkMode = hour >= 19 || hour < 6;
    this.globalData.isDarkMode = isDarkMode;
    this.updateNavigationBar(isDarkMode);
    return isDarkMode;
  },
  updateNavigationBar: function(isDarkMode) {
    if (isDarkMode) {
      qq.setNavigationBarColor({
        frontColor: '#ffffff',
        backgroundColor: '#1e1e1e',
        animation: { duration: 300, timingFunc: 'easeIn' }
      });
    } else {
      qq.setNavigationBarColor({
        frontColor: '#000000',
        backgroundColor: '#ffffff',
        animation: { duration: 300, timingFunc: 'easeIn' }
      });
    }
  },
  globalData: {
    userInfo: null,
    isDarkMode: false,
    currentArticle: null,
    statusBarHeight: 20, // 默认值
    navBarHeight: 44     // 默认值
  }
})
