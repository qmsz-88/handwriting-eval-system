@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ============================================================
echo   书写智能评价 - Android APK 一键构建脚本 (Windows)
echo   目标: 生成 app-debug.apk
echo   要求: 能联网的 Windows 电脑 (会下载约 800MB 构建工具链)
echo ============================================================
echo.

set PROJECT_DIR=%~dp0
set BUILD_TOOLS_DIR=C:\build-tools
set JDK_DIR=%BUILD_TOOLS_DIR%\jdk-17
set ANDROID_SDK_DIR=%BUILD_TOOLS_DIR%\android-sdk

REM 与 android\variables.gradle 保持一致 (compileSdk/targetSdk = 33)
set SDK_PLATFORM=platforms;android-33
set BUILD_TOOLS=build-tools;33.0.2

REM ---------- 检测是否已安装 Android Studio 的 SDK ----------
set AS_SDK=
if defined LOCALAPPDATA if exist "%LOCALAPPDATA%\Android\Sdk" set AS_SDK=%LOCALAPPDATA%\Android\Sdk
if defined ANDROID_HOME if exist "%ANDROID_HOME%" set AS_SDK=%ANDROID_HOME%
if defined ANDROID_SDK_ROOT if exist "%ANDROID_SDK_ROOT%" set AS_SDK=%ANDROID_SDK_ROOT%
if defined AS_SDK (
    if exist "%AS_SDK%\cmdline-tools\latest\bin\sdkmanager.bat" (
        echo [检测] 发现 Android Studio 自带 SDK: %AS_SDK%
        set ANDROID_SDK_DIR=%AS_SDK%
    ) else (
        echo [检测] 发现 %AS_SDK% 但缺少 cmdline-tools，将改用独立 SDK 目录
        set AS_SDK=
    )
)

REM ---------- 网络连通性快速自检 ----------
echo [0/5] 网络连通性自检...
set NET_OK=0
for %%H in ("https://dl.google.com" "https://services.gradle.org" "https://repo.maven.apache.org") do (
    curl -L -I --ssl-no-revoke --connect-timeout 8 --max-time 15 %%H >nul 2>&1
    if not errorlevel 1 set NET_OK=1
)
if "%NET_OK%"=="0" (
    echo.
    echo   警告：网络似乎不通（无法访问 dl.google.com / services.gradle.org）。
    echo   请确认：
    echo     1. 电脑已连接互联网
    echo     2. 没有防火墙/代理拦截（如有代理请在系统设置中配置）
    echo     3. 若在公司内网，可能需要配置代理环境变量
    echo.
    echo   脚本将尝试继续，若下载失败请检查网络后重试。
    echo.
    timeout /t 3 >nul
)

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
curl -L --ssl-no-revoke --connect-timeout 30 --max-time 2400 -o "%OUT%" "%URL%"
if errorlevel 1 (
    echo   下载失败！
    exit /b 1
)
REM 校验文件非空且非 HTML 错误页
powershell -NoProfile -Command "$f=Get-Item '%OUT%'; if($f.Length -lt 1024){exit 1}" >nul 2>&1
if errorlevel 1 (
    echo   文件无效（过小），删除重试
    del /Q "%OUT%" 2>nul
    exit /b 1
)
exit /b 0

REM ---------- Step 1: JDK 17 ----------
if exist "%JDK_DIR%\bin\javac.exe" (
    echo [1/5] JDK 已安装，跳过
) else (
    echo [1/5] 下载并安装 JDK 17...
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
    powershell -NoProfile -Command "Expand-Archive -Path jdk17.zip -DestinationPath . -Force" >nul
    if exist "jdk-17.0.10.7-hotspot" ren "jdk-17.0.10.7-hotspot" "jdk-17"
    if not exist "%JDK_DIR%\bin\javac.exe" (
        echo   解压后未找到 JDK，请检查 jdk17.zip
        pause
        exit /b 1
    )
    echo   JDK 安装完成
)

REM ---------- Step 2: Android SDK (cmdline-tools) ----------
if exist "%ANDROID_SDK_DIR%\cmdline-tools\latest\bin\sdkmanager.bat" (
    echo [2/5] Android SDK 已安装，跳过
) else (
    echo [2/5] 下载并安装 Android SDK cmdline-tools...
    cd /d "%BUILD_TOOLS_DIR%"
    set CT_URL=https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip
    set CT_URL_B=https://mirrors.huaweicloud.com/android/repository/commandlinetools-win-11076708_latest.zip
    if not exist cmdline-tools.zip (
        echo   尝试 Google 官方源...
        call :download "%CT_URL%" "cmdline-tools.zip" "Android cmdline-tools (官方)"
        if errorlevel 1 (
            echo   官方源失败，尝试华为云镜像...
            call :download "%CT_URL_B%" "cmdline-tools.zip" "Android cmdline-tools (镜像)"
            if errorlevel 1 (
                echo   下载失败！请手动下载 commandlinetools-win-11076708_latest.zip 放到 %BUILD_TOOLS_DIR%
                pause
                exit /b 1
            )
        )
    )
    echo   解压中...
    powershell -NoProfile -Command "Expand-Archive -Path cmdline-tools.zip -DestinationPath . -Force" >nul
    if not exist "android-sdk" mkdir "android-sdk"
    if not exist "android-sdk\cmdline-tools" mkdir "android-sdk\cmdline-tools"
    if exist "cmdline-tools\latest" (
        REM 镜像包解出已是 latest 结构
        xcopy /E /I /Y "cmdline-tools\latest" "android-sdk\cmdline-tools\latest" >nul
    ) else if exist "cmdline-tools" (
        REM 官方包解出是 bin/lib 直接在 cmdline-tools 下，需移到 latest
        mkdir "android-sdk\cmdline-tools\latest" 2>nul
        xcopy /E /I /Y "cmdline-tools\*" "android-sdk\cmdline-tools\latest\" >nul
    )
    rd /S /Q "cmdline-tools" 2>nul
    if not exist "%ANDROID_SDK_DIR%\cmdline-tools\latest\bin\sdkmanager.bat" (
        echo   cmdline-tools 安装失败，请检查
        pause
        exit /b 1
    )
    echo   Android SDK cmdline-tools 安装完成
)

REM ---------- Step 3: 设置环境变量 ----------
echo [3/5] 配置构建环境...
set JAVA_HOME=%JDK_DIR%
set ANDROID_HOME=%ANDROID_SDK_DIR%
set ANDROID_SDK_ROOT=%ANDROID_SDK_DIR%
set PATH=%JDK_DIR%\bin;%ANDROID_SDK_DIR%\cmdline-tools\latest\bin;%ANDROID_SDK_DIR%\platform-tools;%PATH%

REM ---------- Step 4: 安装 SDK 组件 ----------
echo [4/5] 安装 Android 平台和构建工具...
echo   版本: %SDK_PLATFORM% + %BUILD_TOOLS% + platform-tools
echo   接受许可...
echo y | sdkmanager --licenses >nul 2>&1

sdkmanager "platform-tools" "%SDK_PLATFORM%" "%BUILD_TOOLS%" 2>nul
if errorlevel 1 (
    echo   首次安装失败，重试一次...
    echo y | sdkmanager --licenses >nul 2>&1
    sdkmanager "platform-tools" "%SDK_PLATFORM%" "%BUILD_TOOLS%" 2>nul
)
if errorlevel 1 (
    echo.
    echo   组件安装失败！可能原因：
    echo     1. 网络无法访问 dl.google.com（多为国内网络），建议配置代理或使用镜像。
    echo     2. 磁盘空间不足。
    echo.
    pause
    exit /b 1
)

REM 校验关键组件是否装好
if not exist "%ANDROID_SDK_DIR%\platforms\android-33\android.jar" (
    echo   警告：未检测到 android-33 平台，继续尝试（可能已装到其他位置）...
)

echo   组件安装完成

REM ---------- Step 5: 构建 APK ----------
echo [5/5] 构建 APK...
cd /d "%PROJECT_DIR%android"
if not exist "gradlew.bat" (
    echo   错误：未找到 gradlew.bat
    pause
    exit /b 1
)

echo   开始 Gradle 构建（首次会下载 Gradle 与依赖，可能需要 10-30 分钟）...
call gradlew.bat assembleDebug --no-daemon -Dorg.gradle.internal.network.retry.max.attempts=10
if errorlevel 1 (
    echo.
    echo   构建失败！请查看上方日志。
    echo   常见原因：网络下载 Gradle/Maven 依赖超时，请重试或在 gradle.properties 配置镜像。
    pause
    exit /b 1
)

set APK_PATH=%PROJECT_DIR%android\app\build\outputs\apk\debug\app-debug.apk
if exist "%APK_PATH%" (
    echo.
    echo ===============================================
    echo   构建成功！
    echo   APK 路径: %APK_PATH%
    for %%I in ("%APK_PATH%") do echo   APK 大小: %%~zI 字节
    echo.
    echo   安装方法：把 app-debug.apk 传到安卓手机，
    echo   打开 设置→安全→允许未知来源，点击安装即可。
    echo ===============================================
    explorer /select,"%APK_PATH%"
) else (
    echo   未找到生成的 APK，请检查构建日志
    pause
    exit /b 1
)

pause
