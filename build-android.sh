#!/bin/bash
# ============================================================
# Windows 一键构建 Android APK 脚本
# 自动下载 JDK17 + Android SDK，编译 Debug APK
# ============================================================
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_TOOLS_DIR="C:/build-tools"
JDK_DIR="$BUILD_TOOLS_DIR/jdk-17"
ANDROID_SDK_DIR="$BUILD_TOOLS_DIR/android-sdk"
ANDROID_SDK_VERSION="11076708"
BUILD_TOOLS_VERSION="33.0.2"
PLATFORM_VERSION="android-33"

echo "==============================================="
echo "  Android APK 构建脚本"
echo "  目标: 生成 app-debug.apk"
echo "==============================================="

# Step 1: 下载并安装 JDK 17
if [ ! -d "$JDK_DIR" ]; then
  echo "[1/4] 下载并安装 JDK 17..."
  mkdir -p "$BUILD_TOOLS_DIR"
  cd "$BUILD_TOOLS_DIR"
  if [ ! -f jdk17.zip ]; then
    curl -L -o jdk17.zip "https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.10%2B7/OpenJDK17U-jdk_x64_windows_hotspot_17.0.10_7.zip"
  fi
  powershell -Command "Expand-Archive -Path jdk17.zip -DestinationPath . -Force"
  rm -rf "$JDK_DIR"
  mv jdk-17.0.10.7-hotspot "$JDK_DIR"
  echo "  JDK 安装完成: $JDK_DIR"
else
  echo "[1/4] JDK 已安装，跳过"
fi

# Step 2: 下载并安装 Android SDK
if [ ! -d "$ANDROID_SDK_DIR/cmdline-tools" ]; then
  echo "[2/4] 下载并安装 Android SDK..."
  cd "$BUILD_TOOLS_DIR"
  if [ ! -f cmdline-tools.zip ]; then
    curl -L -o cmdline-tools.zip "https://dl.google.com/android/repository/commandlinetools-win-${ANDROID_SDK_VERSION}_latest.zip"
  fi
  powershell -Command "Expand-Archive -Path cmdline-tools.zip -DestinationPath . -Force"
  mkdir -p android-sdk/cmdline-tools/latest
  mv cmdline-tools/* android-sdk/cmdline-tools/latest/
  rm -rf cmdline-tools
  echo "  Android SDK 安装完成"
else
  echo "[2/4] Android SDK 已安装，跳过"
fi

# Step 3: 安装 Android 平台和构建工具
echo "[3/4] 安装 Android 平台和构建工具..."
export JAVA_HOME="$JDK_DIR"
export ANDROID_HOME="$ANDROID_SDK_DIR"
export ANDROID_SDK_ROOT="$ANDROID_SDK_DIR"
export PATH="$JDK_DIR/bin:$ANDROID_SDK_DIR/cmdline-tools/latest/bin:$ANDROID_SDK_DIR/platform-tools:$PATH"

# 接受许可
yes | sdkmanager --licenses > /dev/null 2>&1 || true

# 安装必要组件
sdkmanager "platform-tools" "platforms;${PLATFORM_VERSION}" "build-tools;${BUILD_TOOLS_VERSION}" 2>&1 | tail -5
echo "  组件安装完成"

# Step 4: 构建 APK
echo "[4/4] 构建 APK..."
cd "$PROJECT_DIR/android"
chmod +x gradlew
./gradlew assembleDebug --no-daemon 2>&1 | tail -20

APK_PATH="$PROJECT_DIR/android/app/build/outputs/apk/debug/app-debug.apk"
if [ -f "$APK_PATH" ]; then
  echo ""
  echo "==============================================="
  echo "  ✅ APK 构建成功！"
  echo "  路径: $APK_PATH"
  echo "  大小: $(du -h "$APK_PATH" | cut -f1)"
  echo "==============================================="
else
  echo ""
  echo "❌ 构建失败，请查看上方日志"
  exit 1
fi
