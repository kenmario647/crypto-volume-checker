#!/bin/bash

# crypto-volume-checker 停止スクリプト

APP_DIR="/Users/satoukengo/crypto-volume-checker"
LOG_DIR="$APP_DIR/logs"

echo "🛑 Stopping crypto-volume-checker..."

# PIDファイルから停止
if [ -f "$LOG_DIR/backend.pid" ]; then
    BACKEND_PID=$(cat "$LOG_DIR/backend.pid")
    if kill -0 "$BACKEND_PID" 2>/dev/null; then
        kill "$BACKEND_PID"
        echo "📡 Backend stopped (PID: $BACKEND_PID)"
    fi
    rm -f "$LOG_DIR/backend.pid"
fi

if [ -f "$LOG_DIR/frontend.pid" ]; then
    FRONTEND_PID=$(cat "$LOG_DIR/frontend.pid")
    if kill -0 "$FRONTEND_PID" 2>/dev/null; then
        kill "$FRONTEND_PID"
        echo "🌐 Frontend stopped (PID: $FRONTEND_PID)"
    fi
    rm -f "$LOG_DIR/frontend.pid"
fi

# 念のため全プロセス停止
pkill -f "node.*dist/index.js" 2>/dev/null || true
pkill -f "react-scripts start" 2>/dev/null || true

echo "✅ crypto-volume-checker stopped successfully!"