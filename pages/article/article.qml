<view class="article-container {{isDarkMode ? 'dark-mode' : ''}}">
  <!-- 自定义左对齐导航栏 -->
  <view class="custom-nav" style="padding-top: {{statusBarHeight}}px; height: {{navBarHeight}}px;">
    <view class="nav-content">
      <view class="back-btn" bindtap="goBack">
        <image class="back-icon" src="../../icons/back.svg" mode="aspectFit"></image>
      </view>
      <text class="nav-title">chuzouX's Blog</text>
    </view>
  </view>

  <view style="height: {{statusBarHeight + navBarHeight}}px;"></view>

  <!-- 文章头部信息 -->
  <view class="article-header-hero">
    <image wx:if="{{article.cover}}" class="article-cover" src="{{article.cover}}" mode="aspectFill" bindtap="previewSingleImage" data-src="{{article.cover}}"></image>
    <view class="article-header-info">
      <text class="article-title">{{article.title}}</text>
      <view class="article-meta-row">
        <text class="article-meta-item">{{article.date}}</text>
        <text class="article-meta-item">chuzouX</text>
      </view>
    </view>
  </view>

  <view class="article-divider"></view>
  
  <view class="article-content">
    <block wx:for="{{article.segments}}" wx:key="index">
      <rich-text wx:if="{{item.type === 'html'}}" nodes="{{item.content}}" bindlinktap="handleLinkTap" bindtap="handleRichTextTap"></rich-text>
      <block wx:if="{{item.type === 'img'}}">
        <image wx:if="{{!item.isMath}}" src="{{item.src}}" mode="widthFix" bindtap="previewSingleImage" data-src="{{item.src}}" class="article-img"></image>
        <image wx:else src="{{item.src}}" mode="aspectFit" class="math-img-component"></image>
      </block>
    </block>
  </view>
  
  <view class="article-footer">
    <button class="copy-btn" bindtap="copyOriginalLink">复制原文链接</button>
    <text class="hint">注：部分复杂格式可能无法完全显示</text>
  </view>
</view>
