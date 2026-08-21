#!/usr/bin/env bash
# ============================================================
# 中小学生字体书写智能评价系统 —— 云服务器一键部署脚本
# 用法（在服务器上以 root 运行）：
#   curl -fsSL https://raw.githubusercontent.com/qmsz-88/handwriting-eval-system/main/server-setup.sh | bash
# 或下载后运行： bash server-setup.sh
# 支持：Ubuntu 20.04+ / Debian 11+ / CentOS 7+（含 OpenCloudOS）
# ============================================================
set -e

APP_DIR=/opt/handwriting-eval
REPO=https://github.com/qmsz-88/handwriting-eval-system.git
APP_USER=hwapp
SERVICE=handwriting-eval

echo "==> [1/6] 安装 Node.js 20"
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 18 ]; then
    if command -v apt-get >/dev/null 2>&1; then
        apt-get update -y
        apt-get install -y curl ca-certificates gnupg git
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
    elif command -v yum >/dev/null 2>&1; then
        yum install -y curl ca-certificates git
        curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
        yum install -y nodejs
    else
        echo "!! 无法识别的包管理器，请手动安装 Node.js 18+"; exit 1
    fi
fi
echo "    Node 版本: $(node -v)"

echo "==> [2/6] 创建运行用户与目录"
id -u "$APP_USER" >/dev/null 2>&1 || useradd -r -m -d "$APP_DIR" -s /usr/sbin/nologin "$APP_USER"
mkdir -p "$APP_DIR"

echo "==> [3/6] 获取最新代码"
if [ -d "$APP_DIR/.git" ]; then
    cd "$APP_DIR" && git fetch --depth 1 origin main && git reset --hard origin/main
else
    git clone --depth 1 "$REPO" "$APP_DIR"
    cd "$APP_DIR"
fi

echo "==> [4/6] 安装依赖"
npm install --omit=dev --no-audit --no-fund

mkdir -p "$APP_DIR/data" "$APP_DIR/uploads" "$APP_DIR/logs"

echo "==> [5/6] 配置 systemd 开机自启服务（端口 80）"
cat > "/etc/systemd/system/${SERVICE}.service" <<EOF
[Unit]
Description=Handwriting Evaluation System
After=network.target

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}
Environment=PORT=80
Environment=NODE_ENV=production
ExecStart=$(command -v node) ${APP_DIR}/server.js
Restart=always
RestartSec=5
AmbientCapabilities=CAP_NET_BIND_SERVICE
StandardOutput=append:${APP_DIR}/logs/server.log
StandardError=append:${APP_DIR}/logs/server.log

[Install]
WantedBy=multi-user.target
EOF

chown -R "$APP_USER:$APP_USER" "$APP_DIR"
systemctl daemon-reload
systemctl enable "$SERVICE" >/dev/null 2>&1
systemctl restart "$SERVICE"

echo "==> [6/6] 健康检查"
sleep 3
if curl -s --max-time 5 http://localhost/api/health | grep -q '"code":0'; then
    echo ""
    echo "============================================================"
    echo "✅ 部署成功！系统已在 80 端口运行"
    echo ""
    echo "  访问地址:  http://<服务器公网IP>/"
    echo "  学生端:    http://<服务器公网IP>/student.html"
    echo "  家长端:    http://<服务器公网IP>/parent.html"
    echo ""
    echo "  常用命令:"
    echo "    systemctl status ${SERVICE}    查看状态"
    echo "    systemctl restart ${SERVICE}   重启服务"
    echo "    journalctl -u ${SERVICE} -f    看实时日志"
    echo "    tail -f ${APP_DIR}/logs/server.log  看应用日志"
    echo ""
    echo "  ⚠️ 别忘了在云控制台的安全组里放行 TCP 80 端口"
    echo "  更新代码: cd ${APP_DIR} && git pull && systemctl restart ${SERVICE}"
    echo "============================================================"
else
    echo "!! 服务启动异常，查看日志排查:"
    echo "   tail -50 ${APP_DIR}/logs/server.log"
    exit 1
fi
