@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ===============================================
echo   Android APK 一键构建脚本 (Windows)
echo   目标: 生成 app-debug.apk
echo ===============================================

set PROJECT_DIR=%~dp0
set BUILD_TOOLS_DIR=C:\build-tools
set JDK_DIR=%BUILD_TOOLS_DIR%\jdk-17
set ANDROID_SDK_DIR=%BUILD_TOOLS_DIR%\android-sdk

REM ---------- 下载函数：支持多镜像重试 ----------
:download
set URL=%~1
set OUT=%~2
set DESC=%~3
if exist "%OUT%" (
    echo   已存在 %DESC%，跳过
    exit /b 0
)
echo   尝试下载 %DESC% ...
echo   URL: %URL%
curl -L --ssl-no-revoke --connect-timeout 30 --max-time 1800 -o "%OUT%" "%URL%"
if errorlevel 1 (
    echo   下载失败！
    exit /b 1
)
dir "%OUT%" | findstr /R "^[ ]*[0-9]" >nul 2>&1 || (
    echo   文件无效
    del /Q "%OUT%" 2>nul
    exit /b 1
)
exit /b 0

REM ---------- Step 1: JDK 17 ----------
if exist "%JDK_DIR%\bin\javac.exe" (
    echo [1/4] JDK 已安装，跳过
) else (
    echo [1/4] 下载并安装 JDK 17...
    if not exist "%BUILD_TOOLS_DIR%" mkdir "%BUILD_TOOLS_DIR%"
    cd /d "%BUILD_TOOLS_DIR%"

    set MIRROR=0
    :jdk_loop
    if %MIRROR%==0 (
        call :download "https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.10+7/OpenJDK17U-jdk_x64_windows_hotspot_17.0.10_7.zip" "jdk17.zip" "Adoptium 官方源"
    ) else if %MIRROR%==1 (
        call :download "https://mirrors.aliyun.com/Adoptium/17/jdk/x64/windows/OpenJDK17U-jdk_x64_windows_hotspot_17.0.10_7.zip" "jdk17.zip" "阿里云镜像"
    ) else if %MIRROR%==2 (
        call :download "https://mirrors.huaweicloud.com/openjdk/17/openjdk-17.0.10-windows-x64.zip" "jdk17.zip" "华为云镜像"
    ) else (
        echo   所有镜像均失败！请手动下载 JDK17 放到 %BUILD_TOOLS_DIR%\jdk17.zip
        pause
        exit /b 1
    )
    if errorlevel 1 (
        set /a MIRROR+=1
        goto jdk_loop
    )

    echo   解压中...
    powershell -Command "Expand-Archive -Path jdk17.zip -DestinationPath . -Force" >nul
    if exist "jdk-17.0.10.7-hotspot" ren "jdk-17.0.10.7-hotspot" "jdk-17"
    if not exist "%JDK_DIR%\bin\javac.exe" (
        echo   解压后未找到 JDK，请检查 jdk17.zip
        pause
        exit /b 1
    )
    echo   JDK 安装完成
)

REM ---------- Step 2: Android SDK ----------
if exist "%ANDROID_SDK_DIR%\cmdline-tools\latest\bin\sdkmanager.bat" (
    echo [2/4] Android SDK 已安装，跳过
) else (
    echo [2/4] 下载并安装 Android SDK...
    cd /d "%BUILD_TOOLS_DIR%"
    if not exist cmdline-tools.zip (
        curl -L --ssl-no-revoke --connect-timeout 30 --max-time 1800 -o cmdline-tools.zip "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip"
    )
    if not exist cmdline-tools.zip (
        echo   下载失败！请手动下载 commandlinetools-win-11076708_latest.zip 放到 %BUILD_TOOLS_DIR%
        pause
        exit /b 1
    )
    echo   解压中...
    powershell -Command "Expand-Archive -Path cmdline-tools.zip -DestinationPath . -Force" >nul
    if not exist "android-sdk\cmdline-tools" mkdir "android-sdk\cmdline-tools" 2>nul
    if exist "cmdline-tools" (
        xcopy /E /I /Y "cmdline-tools" "android-sdk\cmdline-tools\latest" >nul
        rd /S /Q "cmdline-tools"
    )
    echo   Android SDK 安装完成
)

REM ---------- Step 3: 安装组件 ----------
echo [3/4] 安装 Android 平台和构建工具...
set JAVA_HOME=%JDK_DIR%
set ANDROID_HOME=%ANDROID_SDK_DIR%
set ANDROID_SDK_ROOT=%ANDROID_SDK_DIR%
set PATH=%JDK_DIR%\bin;%ANDROID_SDK_DIR%\cmdline-tools\latest\bin;%ANDROID_SDK_DIR%\platform-tools;%PATH%

echo   接受许可...
echo y | sdkmanager --licenses >nul 2>&1

echo   安装 platform-tools / platforms;android-34 / build-tools;34.0.0
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"
if errorlevel 1 (
    echo   组件安装失败！尝试更换镜像...
    set GRADLE_OPTS=-Dorg.gradle.internal.network.retry.max.attempts=10
    echo   重试中...
    sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"
)
echo   组件安装完成

REM ---------- Step 4: 构建 APK ----------
echo [4/4] 构建 APK...
cd /d "%PROJECT_DIR%android"
if not exist "gradlew" (
    echo   错误：未找到 gradlew
    pause
    exit /b 1
)

call gradlew.bat assembleDebug --no-daemon -Dorg.gradle.internal.network.retry.max.attempts=10
if errorlevel 1 (
    echo.
    echo   构建失败！请查看上方日志
    pause
    exit /b 1
)

set APK_PATH=%PROJECT_DIR%android\app\build\outputs\apk\debug\app-debug.apk
if exist "%APK_PATH%" (
    echo.
    echo ===============================================
    echo   ✅ APK 构建成功！
    echo   路径: %APK_PATH%
    for %%I in ("%APK_PATH%") do echo   大小: %%~zI 字节
    echo ===============================================
    explorer /select,"%APK_PATH%"
) else (
    echo   未找到生成的 APK
    pause
    exit /b 1
)

pause
