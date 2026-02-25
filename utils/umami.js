const CONFIG = {
  websiteId: 'a18f07f6-88e5-4926-b16a-0cdf20da0c4b',
  hostUrl: 'https://umami.chuzoux.top',
  apiUrl: 'https://umami.chuzoux.top/api/send',
  hostname: 'qq-mini-program' // 自定义 hostname 以区分
};

let systemInfo = null;

function getSystemInfo() {
  if (systemInfo) return systemInfo;
  try {
    systemInfo = qq.getSystemInfoSync();
  } catch (e) {
    console.error('获取系统信息失败', e);
    systemInfo = {
      screenWidth: 375,
      screenHeight: 667,
      language: 'zh_CN',
      system: 'Unknown',
      version: 'Unknown'
    };
  }
  return systemInfo;
}

/**
 * 发送统计数据
 * @param {Object} params - 统计参数
 * @param {string} type - 'event' | 'identify'
 */
function send(params, type = 'event') {
  const info = getSystemInfo();
  
  // 构造 User-Agent
  // QQ小程序默认 UA 包含 MiniProgramEnv/QQ，但为了区分，我们可以自定义
  // 格式：Mozilla/5.0 (...) ... QQ-Mini-Program/1.0
  const customUA = `Mozilla/5.0 (${info.system}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Mobile Safari/537.36 QQ-Mini-Program/${info.version} Umami-Tracker`;

  const payload = {
    website: CONFIG.websiteId,
    hostname: CONFIG.hostname,
    screen: `${info.screenWidth}x${info.screenHeight}`,
    language: info.language || 'zh_CN',
    title: params.title || '',
    url: params.url || '/',
    referrer: params.referrer || ''
  };

  // 如果是自定义事件，合并 name
  if (params.name) {
    payload.name = params.name;
  }
  
  // 将自定义 UA 和其他数据放入 data 字段
  const eventData = {
    userAgent: customUA,
    ...(params.data || {})
  };
  
  if (Object.keys(eventData).length > 0) {
    payload.data = eventData;
  }

  qq.request({
    url: CONFIG.apiUrl,
    method: 'POST',
    header: {
      'Content-Type': 'application/json'
    },
    data: {
      type: type,
      payload: payload
    },
    success: (res) => {
      // console.log('Umami track success', res);
    },
    fail: (err) => {
      console.error('Umami track fail', err);
    }
  });
}

/**
 * 页面浏览统计
 * @param {string} path - 页面路径
 * @param {string} referrer - 来源路径
 */
function trackView(path, referrer = '') {
  send({
    url: path,
    referrer: referrer
  });
}

/**
 * 自定义事件统计
 * @param {string} eventName - 事件名称
 * @param {Object} eventData - 事件数据
 * @param {string} url - 当前路径
 */
function trackEvent(eventName, eventData = {}, url) {
  const pages = getCurrentPages() || [];
  const currentPage = pages.length > 0 ? pages[pages.length - 1] : null;
  const currentUrl = url || (currentPage ? `/${currentPage.route}` : '/');

  send({
    url: currentUrl,
    name: eventName,
    data: eventData
  });
}

// 劫持 Page 方法以实现自动统计
const originalPage = Page;
Page = function(config) {
  const { onShow } = config;
  
  config.onShow = function() {
    // 自动上报页面浏览
    const pages = getCurrentPages() || [];
    const currentPage = pages.length > 0 ? pages[pages.length - 1] : null;
    let referrer = '';
    
    if (pages.length > 1) {
      referrer = `/${pages[pages.length - 2].route}`;
    }
    
    if (currentPage) {
      const path = `/${currentPage.route}`;
      trackView(path, referrer);
    }

    // 执行原有的 onShow
    if (onShow) {
      onShow.call(this);
    }
  };
  
  return originalPage(config);
};

module.exports = {
  trackView,
  trackEvent
};
