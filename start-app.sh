#!/bin/bash

# crypto-volume-checker 自動起動スクリプト

APP_DIR="/Users/satoukengo/crypto-volume-checker"
LOG_DIR="$APP_DIR/logs"

# ログディレクトリ作成
mkdir -p "$LOG_DIR"

echo "🚀 Starting crypto-volume-checker..." | tee "$LOG_DIR/startup.log"

# バックエンド起動
echo "📡 Starting backend..." | tee -a "$LOG_DIR/startup.log"
cd "$APP_DIR/backend"
nohup node dist/index.js > "$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
echo "Backend started with PID: $BACKEND_PID" | tee -a "$LOG_DIR/startup.log"

# 3秒待機
sleep 3

# フロントエンド起動
echo "🌐 Starting frontend..." | tee -a "$LOG_DIR/startup.log"
cd "$APP_DIR/frontend"
nohup npm start > "$LOG_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "Frontend started with PID: $FRONTEND_PID" | tee -a "$LOG_DIR/startup.log"

# PIDを保存
echo "$BACKEND_PID" > "$LOG_DIR/backend.pid"
echo "$FRONTEND_PID" > "$LOG_DIR/frontend.pid"

echo "✅ crypto-volume-checker started successfully!" | tee -a "$LOG_DIR/startup.log"
echo "🔗 Frontend: http://localhost:3000" | tee -a "$LOG_DIR/startup.log"
echo "🔗 Backend: http://localhost:5000" | tee -a "$LOG_DIR/startup.log"

# ブラウザを5秒後に開く
sleep 5
open http://localhost:3000