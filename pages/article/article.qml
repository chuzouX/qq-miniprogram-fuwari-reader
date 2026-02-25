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
      <text class="article-title" user-select="true">{{article.title}}</text>
      <view class="article-meta-row">
        <text class="article-meta-item">{{article.date}}</text>
        <text class="article-meta-item">chuzouX</text>
      </view>
      <view class="article-meta-row" style="margin-top: 12rpx;" wx:if="{{article.wordCount || article.readingTime}}">
        <text class="article-meta-item" wx:if="{{article.wordCount}}">字数: {{article.wordCount}}</text>
        <text class="article-meta-item" wx:if="{{article.readingTime}}">预计阅读: {{article.readingTime}}分钟</text>
      </view>
    </view>
  </view>

  <view class="article-divider"></view>
  
  <view class="article-content">
    <block wx:for="{{article.segments}}" wx:key="index">
      <rich-text wx:if="{{item.type === 'html'}}" nodes="{{item.content}}" user-select="true" bindlinktap="handleLinkTap"></rich-text>
      <view wx:elif="{{item.type === 'code'}}" class="md-pre">
        <scroll-view scroll-x="true" class="md-pre-scroll">
          <rich-text nodes="{{item.codeHtml}}" class="md-code" user-select="true"></rich-text>
        </scroll-view>
        <view class="md-copy-btn" bindtap="copyCode" data-code="{{item.rawCode}}"></view>
      </view>
      <view wx:elif="{{item.type === 'github'}}" class="github-card" bindtap="copyCode" data-code="{{item.link}}">
        <view class="github-card-title">{{item.repo}}</view>
        <text class="github-card-link" user-select="true">{{item.link}}</text>
      </view>
      <view wx:elif="{{item.type === 'heading'}}" class="heading-container">
        <view id="{{item.anchorId}}" class="anchor-target"></view>
        <view wx:if="{{item.compactId}}" id="{{item.compactId}}" class="anchor-target"></view>
        <rich-text nodes="{{item.html}}"></rich-text>
      </view>
      <view wx:elif="{{item.type === 'p-text'}}" class="text-para">
        <block wx:for="{{item.nodes}}" wx:key="index" wx:for-item="node">
          <text wx:if="{{node.type === 'text'}}" class="{{node.link ? 'text-link' : ''}} {{node.bold ? 'text-bold' : ''}} {{node.italic ? 'text-italic' : ''}} {{node.code ? 'text-code' : ''}}" user-select="{{!node.link}}" bindtap="{{node.link ? 'handleTextLinkTap' : ''}}" data-code="{{node.link.href}}">{{node.text}}</text>
          <text wx:if="{{node.type === 'br'}}">\n</text>
        </block>
      </view>
      <view wx:elif="{{item.type === 'list'}}" class="list-container">
        <block wx:for="{{item.items}}" wx:key="index" wx:for-item="listItem">
          <view class="list-item">
            <!-- 强制渲染圆点，避免 wx:if 导致的布局问题 -->
            <view class="list-bullet" style="{{item.tag === 'ul' ? '' : 'display:none;'}}">●</view>
            <view class="list-number" wx:if="{{item.tag !== 'ul'}}">{{(item.start || 1) + index}}.</view>
            <view class="list-content">
              <block wx:for="{{listItem.nodes}}" wx:key="nodeIndex" wx:for-item="node">
                <text wx:if="{{node.type === 'text'}}" class="{{node.link ? 'text-link' : ''}} {{node.bold ? 'text-bold' : ''}} {{node.italic ? 'text-italic' : ''}} {{node.code ? 'text-code' : ''}}" user-select="{{!node.link}}" bindtap="{{node.link ? 'handleTextLinkTap' : ''}}" data-code="{{node.link.href}}">{{node.text}}</text>
                <text wx:if="{{node.type === 'br'}}">\n</text>
              </block>
            </view>
          </view>
        </block>
      </view>
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
