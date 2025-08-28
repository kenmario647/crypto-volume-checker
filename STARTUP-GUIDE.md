# 🚀 crypto-volume-checker 自動起動設定完了

## ✅ 設定済みファイル
- `start-app.sh` - アプリ起動スクリプト
- `stop-app.sh` - アプリ停止スクリプト  
- `CryptoVolumeChecker.app.command` - デスクトップランチャー

## 📋 パソコン起動時の自動実行設定

### 方法1: ログイン項目に追加 (推奨)
1. **システム環境設定** を開く
2. **ユーザとグループ** をクリック
3. **ログイン項目** タブを選択
4. **+** ボタンをクリック
5. デスクトップの **CryptoVolumeChecker.app.command** を選択
6. **追加** をクリック

### 方法2: Automatorアプリ作成
1. **Automator** を開く
2. **アプリケーション** を選択
3. **シェルスクリプトを実行** をドラッグ
4. 以下を入力:
   ```
   /Users/satoukengo/crypto-volume-checker/start-app.sh
   ```
5. **ファイル** → **保存** → **Crypto Volume Checker**
6. 保存したアプリをログイン項目に追加

## 🔧 手動操作

### 起動
```bash
cd /Users/satoukengo/crypto-volume-checker
./start-app.sh
```

### 停止
```bash
./stop-app.sh
```

### 状態確認
```bash
# プロセス確認
ps aux | grep -E "(node.*dist|react-scripts)" | grep -v grep

# バックエンド確認
curl http://localhost:5000/health

# フロントエンド確認
open http://localhost:3000
```

## 📊 ログ確認
```bash
# 起動ログ
cat logs/startup.log

# バックエンドログ  
tail -f logs/backend.log

# フロントエンドログ
tail -f logs/frontend.log
```

## ⚡ 完了！
パソコン起動時に crypto-volume-checker が自動で起動し、
ブラウザで http://localhost:3000 が開きます。