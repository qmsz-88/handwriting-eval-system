# Android APK 构建说明

本机（当前沙箱）没有 Java / Android SDK，且无法联网下载工具链，因此**不能在此环境直接产出 .apk 文件**。
下面三种方式任选其一，都能拿到可安装的 `app-debug.apk`。

> ⚠️ 注意：Debug APK 未签名（系统默认 debug 签名），安装时手机需开启"允许未知来源"。
> 如需上架/分发，需另行生成正式签名 keystore 并用 `assembleRelease`。

---

## 方式一（推荐）：GitHub Actions 云端构建 —— 全程不用装任何工具

把项目推送到 GitHub 仓库后，`.github/workflows/build-android.yml` 会自动构建并产出可下载的 APK。

### 步骤
1. 在 GitHub 新建一个仓库（public 或 private 均可，private 每月有免费额度）。
2. 把本目录推上去：
   ```bash
   cd handwriting-eval-system
   git init
   git add -A
   git commit -m "init handwriting eval system"
   git branch -M main
   git remote add origin https://github.com/<你的用户名>/<仓库名>.git
   git push -u origin main
   ```
   > 首次推送会自动触发构建；之后改了 `public/` 或 `android/` 再 push 也会自动重建。
   > 也可手动触发：仓库 → **Actions** → **Build Android APK** → **Run workflow**。
3. 构建约 5–10 分钟。完成后进入该次运行 → 拉到页面最下方 **Artifacts** → 下载 `handwriting-eval-android-apk`（解压即得 `app-debug.apk`）。
4. 把 APK 传到手机安装。

**优点**：零本地环境、免费、可重复。**这是当前拿到真实 APK 最快的途径。**

---

## 方式二：Windows 一键脚本（需联网，下载约 800MB 工具链）

适合有一台能联网的 Windows 电脑、且网络通畅（国内可走镜像）。

```bash
# Git Bash 里运行
./build-android.sh

# 或双击
build-android.bat
```

脚本会自动：下载 JDK 17 → 下载 Android SDK → 安装平台与构建工具 → `gradlew assembleDebug`。

- 成功后 APK 位于：`android/app/build/outputs/apk/debug/app-debug.apk`
- 若某镜像慢/失败，脚本已内置阿里云、华为云镜像自动重试。

---

## 方式三：Android Studio（最省心，自带 JDK + SDK）

1. 安装 [Android Studio](https://developer.android.com/studio)。
2. 打开 Android Studio → **Open** → 选择项目里的 `android/` 目录。
3. 等待 Gradle 同步完成（首次会自动下载依赖）。
4. 菜单 **Build → Build Bundle(s) / APK(s) → Build APK(s)**。
5. 完成后点通知里的 **locate** 即可找到 `app-debug.apk`。

---

## 安装到手机

1. 把 `app-debug.apk` 通过微信/QQ/USB/网盘传到安卓手机。
2. 手机"设置 → 安全 → 允许安装未知来源应用"打开。
3. 点击 APK 安装。
4. 打开"书写智能评价"，App 内会加载本地 Web 资源，连到你的后端服务器使用。
   > 若后端在公网，请把 `capacitor.config.json` 里的 server 配好；若只在局域网用，
   > 确保手机和后端在同一 Wi‑Fi。

---

## 常见问题

**Q: gradlew 报 "Could not determine java version" / JDK 版本不对？**
A: 需 JDK 17。方式二/三已自带；手动构建请确认 `java -version` 为 17。

**Q: 网络超时下载不了依赖？**
A: 走方式一（云端）或方式三（Android Studio 通常更稳），或在 `android/gradle.properties` 加镜像：
```
systemProp.https.proxyHost=镜像
```

**Q: 想要正式签名版（release APK）？**
A: 生成 keystore 后改 `android/app/build.gradle` 的 signingConfigs，跑 `./gradlew assembleRelease`。
