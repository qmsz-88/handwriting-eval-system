# iOS 应用构建说明

## ⚠️ 重要前提
iOS 应用必须在 **macOS + Xcode** 环境下构建。本文档假设你拥有一台 Mac 电脑。

## 环境要求

| 工具 | 版本要求 | 用途 |
|------|---------|------|
| macOS | 12.0+ (Monterey) 或更新 | 操作系统 |
| Xcode | 14.0+ | iOS 集成开发环境 |
| Node.js | 18+ | 已安装 |
| CocoaPods | 1.11+ | iOS 依赖管理 |
| Apple ID | 免费账号即可 | 设备调试 / 真机测试 |

## 一次性环境配置

```bash
# 1. 安装 Xcode (从 App Store 下载，约 7GB)

# 2. 安装命令行工具
xcode-select --install

# 3. 安装 CocoaPods
sudo gem install cocoapods
# 或
brew install cocoapods

# 4. 验证环境
xcodebuild -version
pod --version
```

## 构建步骤

### 第 1 步：把项目从 Windows 拷贝到 Mac
将 `handwriting-eval-system/` 整个目录（排除 `node_modules` 和 `data/`）拷贝到 Mac。

### 第 2 步：安装依赖
```bash
cd handwriting-eval-system
npm install
```

### 第 3 步：同步 Web 资源到 iOS 工程
```bash
npx cap sync ios
```

### 第 4 步：安装 CocoaPods 依赖
```bash
cd ios/App
pod install
cd ..
```

### 第 5 步：打开 Xcode 构建
```bash
npx cap open ios
```

Xcode 打开后：
1. 选择左侧 `App` 项目
2. 点击中间 `App` target
3. 在 **Signing & Capabilities** 选项卡：
   - 勾选 `Automatically manage signing`
   - Team 选择你的 Apple ID 个人团队
4. 选择连接的真机或模拟器
5. 点击 ▶️ 运行按钮 或按 ⌘R

### 第 6 步：发布到 App Store（可选）
1. 苹果开发者账号 ($99/年) 在 [developer.apple.com](https://developer.apple.com) 注册
2. Xcode → Product → Archive
3. Distribute App → App Store Connect
4. 在 App Store Connect 中填写资料、截图、隐私政策
5. 等待审核（约 1-3 天）

## 真机调试（无需付费开发者账号）

1. iPhone 用数据线连接 Mac
2. 在 iPhone 上：设置 → 通用 → VPN与设备管理 → 信任开发者证书
3. Xcode 中选择你的 iPhone 作为目标
4. 点击运行，App 安装到 iPhone

## 应用图标说明

图标文件已在 `public/ios-res/AppIcon/` 目录生成：
- icon-20.png / 29 / 40 / 58 / 60 / 76 / 80 / 87 / 120 / 152 / 167 / 180 / 1024
- 全部覆盖 iPhone、iPad、App Store 提交所需的所有尺寸

打开 Xcode 后，导航到 `Assets.xcassets/AppIcon.appiconset/`，将对应尺寸的图标拖入即可（Xcode 会自动匹配）。

## 启动屏

启动屏配置在 `ios/App/App/Base.lproj/LaunchScreen.storyboard`，已设置白色背景 + 蓝紫渐变主题色。

## 常见问题

### Q1: pod install 失败 / 卡住
```bash
# 删除本地 CocoaPods 缓存重试
pod cache clean --all
cd ios/App && pod install --repo-update
```

### Q2: Xcode 报 "Failed to create provisioning profile"
- 确认 Bundle Identifier 唯一（默认 com.family.handwritingeval）
- 确认 Apple ID 已添加到 Xcode → Settings → Accounts

### Q3: 应用打开后是空白页
检查 `capacitor.config.json`：
- 确认 `webDir: "public"` 正确
- 如使用真实后端，把 `server.url` 改为你的线上地址

## 内置 PWA 安装备选方案

如果暂时没有 Mac 设备，用户仍可通过 iPhone Safari 直接安装 PWA：
1. Safari 访问 `https://你的域名`（必须是 HTTPS）
2. 点击底部分享按钮 → "添加到主屏幕"
3. 主屏幕出现"书写评价"图标，使用体验接近原生 App
