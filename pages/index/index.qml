<view class="container {{isDarkMode ? 'dark-mode' : ''}}">
  <!-- 头部展示 -->
  <view class="header">
    <image class="avatar" src="../../logo.jpg" mode="aspectFit"></image>
    <view class="header-info">
      <text class="title">chuzouX's Blog</text>
      <text class="subtitle">欢迎大家光临本站，希望大家在这里可以找到自己想要的东西，祝大家玩的开心！！</text>
    </view>
    <!-- 社交链接 -->
    <view class="social-links">
      <view class="social-item" bindtap="copyLink" data-url="https://space.bilibili.com/491761768">
        <image class="social-icon" src="../../icons/bilibili.svg" mode="aspectFit"></image>
      </view>
      <view class="social-item" bindtap="copyLink" data-url="https://github.com/chuzouX">
        <image class="social-icon" src="../../icons/github.svg" mode="aspectFit"></image>
      </view>
      <view class="social-item" bindtap="copyLink" data-url="chuzoux2163265631@outlook.com">
        <image class="social-icon" src="../../icons/email.svg" mode="aspectFit"></image>
      </view>
    </view>
  </view>

  <!-- 搜索框 -->
  <view class="search-bar">
    <icon type="search" size="16" color="#999"></icon>
    <input class="search-input" placeholder="搜索文章标题..." bindinput="onSearchInput" value="{{searchQuery}}"></input>
    <view wx:if="{{searchQuery}}" class="clear-icon" bindtap="clearSearch">
      <icon type="clear" size="16" color="#ccc"></icon>
    </view>
  </view>

  <!-- 文章列表 -->
  <view class="article-list">
    <view class="list-title">{{searchQuery ? '搜索结果' : '最新文章'}}</view>
    
    <view wx:if="{{loading}}" class="loading-status">加载中...</view>
    <view wx:elif="{{displayArticles.length === 0}}" class="empty-status">未找到相关文章</view>
    
    <block wx:else>
      <view class="article-item" wx:for="{{displayArticles}}" wx:key="link" bindtap="goToArticle" data-index="{{index}}">
        <view class="article-info">
          <text class="article-name">{{item.title}}</text>
          <text class="article-date">{{item.date}}</text>
        </view>
        <view class="copy-tag" catchtap="copyLinkFromList" data-index="{{index}}">复制链接</view>
      </view>
    </block>

    <!-- 分页控件 -->
    <view class="pagination" wx:if="{{!loading && totalPages > 1}}">
      <button class="page-btn" disabled="{{currentPage === 1}}" bindtap="prevPage">上一页</button>
      <text class="page-info">{{currentPage}} / {{totalPages}}</text>
      <button class="page-btn" disabled="{{currentPage === totalPages}}" bindtap="nextPage">下一页</button>
    </view>
  </view>

  <!-- 底部操作 -->
  <view class="footer">
    <button class="copy-btn" type="primary" bindtap="copyLink" data-url="https://chuzoux.top">复制博客主页链接</button>
    <text class="hint">点击文章可直接查看内容</text>
  </view>
</view>