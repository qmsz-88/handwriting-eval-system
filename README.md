# 中小学生字体书写智能评价系统

完整的中文中小学生书写智能评价系统，包含 Web 应用 + iOS + Android 全端方案。

## 🚀 安装方式总览（双端独立：学生端绿色 / 家长端紫色）

> 本系统为**双端独立 App**：学生端（学号+密码登录，绿色）与家长端（昵称登录，紫色）
> 各自独立安装到主屏幕，学生提交记录自动同步到家长端，权限隔离在两端分别生效。

### 方式一：手机浏览器安装 PWA（最快，立即可用，安卓+iPhone 通用）
**适用：任何智能手机，无需任何构建**
1. 后端跑起来（`npm start`，端口 3000），手机与电脑同一 Wi‑Fi。
2. 手机打开 `http://电脑局域网IP:3000`（PWA 全功能需公网 HTTPS，本地 HTTP 也能加到主屏幕）。
3. 选**绿色学生端卡片** → 浏览器菜单"添加到主屏幕" → 得到学生端图标。
4. 选**紫色家长端卡片** → 同样"添加到主屏幕" → 得到家长端图标。
5. 桌面两个独立图标，体验接近原生 App（含离线缓存，Service Worker v2）。

### 方式二：云端构建 Android APK（推荐拿真实 .apk 文件，零本地环境）
把项目推到 GitHub，`.github/workflows/build-android.yml` 会自动构建并产出可下载的 APK。
5–10 分钟后在 Actions 运行页底部 **Artifacts** 下载。详见 [BUILD-ANDROID.md](./BUILD-ANDROID.md)。

### 方式三：本机构建 Android APK（需 Windows + 联网）
运行 `build-android.bat`（或 Git Bash 里 `./build-android.sh`），自动下载 JDK17 + Android SDK 并构建。
脚本会自动安装 **android-33** 平台（与工程 compileSdk 匹配），APK 输出：`android\app\build\outputs\apk\debug\app-debug.apk`。详见 [BUILD-ANDROID.md](./BUILD-ANDROID.md)。

### 方式四：构建 iOS IPA（必须 Mac + Xcode，Windows 无法构建）
> ⚠️ **.ipa 只能在 macOS + Xcode 下生成**，这是 Apple 的硬性限制，Windows 无任何替代方案。
> 没有 Mac 时请用**方式一（iPhone Safari 安装 PWA）**，体验已接近原生。
详见 [BUILD-IOS.md](./BUILD-IOS.md)。Mac 上 `npx cap open ios` 打开 Xcode，用免费 Apple ID 即可安装到自己的 iPhone（无需上架）。

## 📦 项目结构

```
handwriting-eval-system/
├── server.js              # Node.js 后端
├── db.js                  # JSON 数据库层
├── ai-evaluator.js        # AI 评价引擎（4维度+双报告）
├── capacitor.config.json  # Capacitor 原生配置
├── generate-icons-dual.py  # 双端图标生成（学生绿/家长紫）
├── build-android.bat      # Windows 一键构建 Android APK
├── build-android.sh       # Linux/Mac 构建脚本
├── BUILD-ANDROID.md      # Android 构建详细文档（含云端构建）
├── BUILD-IOS.md           # iOS 构建详细文档
├── .github/workflows/     # GitHub Actions 云端构建 APK
├── package.json
│
├── public/                # Web 应用 + 静态资源（双端独立入口）
│   ├── index.html         # 双端选择落地页
│   ├── student.html      # 学生端入口（APP_MODE=student，绿色）
│   ├── parent.html       # 家长端入口（APP_MODE=parent，紫色）
│   ├── manifest-student.json  # 学生端 PWA 清单
│   ├── manifest-parent.json   # 家长端 PWA 清单
│   ├── manifest.json     # 通用 PWA 清单
│   ├── sw.js             # Service Worker v2（按路径回退双入口）
│   ├── css/style.css     # 完整样式
│   ├── js/app.js         # 双端应用逻辑（会话分流+权限隔离）
│   ├── icons/            # 双端 PWA 图标
│   ├── android-res/      # Android 资源
│   └── ios-res/          # iOS 资源
│
├── android/               # Capacitor Android 原生工程
│   ├── app/
│   │   ├── build.gradle
│   │   ├── src/main/
│   │   │   ├── AndroidManifest.xml
│   │   │   ├── assets/public/   # Web 资源（自动同步）
│   │   │   └── res/
│   │   │       ├── mipmap-*/ic_launcher.png
│   │   │       └── values/strings.xml
│   ├── build.gradle
│   ├── gradlew
│   └── gradle.properties
│
├── ios/                   # Capacitor iOS 原生工程
│   ├── App/
│   │   ├── App.xcodeproj
│   │   ├── App.xcworkspace
│   │   ├── Podfile
│   │   ├── App/
│   │   │   ├── Info.plist
│   │   │   └── Assets.xcassets/
│   │   └── capacitor-cordova-ios-plugins/
│
├── data/                  # 用户数据（自动生成）
└── uploads/               # 上传图片（自动生成）
```

## 🎯 功能特性

### 学生端
- 三大检测场景：日常作业 / 日常练字（1-9年级部编版素材）/ 模拟考核
- 拍照自动纠偏、AI 智能识别、双报告自动生成
- 个人薄弱汉字本、每日打卡、积分荣誉
- 不可删除任何记录

### 家长端
- 全程追溯（100%覆盖学生所有记录）
- 家长人工评价（打分+星级+评语+奖惩标签）
- 积分体系（5星+5分 / 4星+3分 / 3星+1分 / 2星0 / 1星-2分）
- 统计趋势图、月度成长报告
- 多孩子档案管理

### AI 核心
- 4维度评分：笔画规范28分 + 间架结构32分 + 卷面习惯25分 + 清晰度15分
- 双报告：问题分析报告 + 改进整改落地报告
- 薄弱汉字自动识别汇总

## 🛠 快速启动

```bash
# 安装依赖
npm install

# 启动 Web 服务
npm start

# 浏览器访问
open http://localhost:3000
```

## 📱 生成/重新生成应用图标

```bash
# 双端图标（学生绿·钢笔+星 / 家长紫·心+星）
python generate-icons-dual.py

# 单端旧版（可选）
python generate-icons.py
```

## 🔧 重新同步原生工程

修改了 public/ 下的 Web 代码后：

```bash
# Android
npx cap sync android

# iOS（在 Mac 上）
npx cap sync ios
```

## 🏗 直接用 Android Studio 构建

如果你已安装 Android Studio（推荐）：

1. 打开 Android Studio → Open → 选择 `android/` 目录
2. 等待 Gradle 同步完成
3. Build → Build Bundle(s) / APK(s) → Build APK(s)
4. 完成！APK 在 `app/build/outputs/apk/debug/`

Android Studio 自带 JDK 和 Android SDK，是最省心的方式。

## 📋 部署到公网（HTTPS + PWA 必备）

PWA 要求 HTTPS。推荐方案：

### 方案 A：云服务器部署
```bash
# 阿里云/腾讯云轻量应用服务器
# 1. 安装 Node.js 18+
# 2. 上传项目代码
# 3. 配置 Nginx 反向代理 + Let's Encrypt SSL
# 4. 用 PM2 守护 Node.js 进程
```

### 方案 B：内网穿透（开发测试）
```bash
# ngrok（国外）
ngrok http 3000

# frp / cpolar（国内推荐）
# 把本地 localhost:3000 暴露到 https://xxx.cpolar.cn
```

### 方案 C：Vercel / Railway 一键部署
需要把后端改造为 Serverless 函数（进阶）

## 🆘 常见问题

**Q: 浏览器看不到"添加到主屏幕"选项？**
A: 必须 HTTPS（localhost 例外）。检查 manifest.json 是否能正常访问（`/manifest.json`）。

**Q: 构建 Android APK 失败？**
A: 大概率是网络问题导致依赖下载失败。建议：
1. 使用 Android Studio 构建（自带所有依赖）
2. 或使用国内镜像（脚本已支持阿里云、华为云镜像切换）

**Q: iOS 应用提交 App Store 被拒？**
A: 这是家庭场景 App，权限声明要清晰。Apple 审核时需要在 App Store Connect 填写：
- 数据用途：仅本机存储 / 不上传第三方
- 内容分级：4+
- 隐私政策 URL

**Q: 如何替换 AI 评价为真实算法？**
A: 修改 `ai-evaluator.js`，接入真实 OCR（如百度AI / 腾讯云AI / OpenAI Vision），将 `evaluate()` 函数返回值替换为真实评分。

## 📄 License
私有项目，保留所有权利。
