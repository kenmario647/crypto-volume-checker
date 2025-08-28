# デプロイメントガイド

## 方法1: Docker を使った VPS デプロイ（AWS EC2、DigitalOcean等）

### 必要なファイル
- `Dockerfile.backend` - バックエンド用Dockerファイル
- `Dockerfile.frontend` - フロントエンド用Dockerファイル  
- `docker-compose.yml` - Docker Compose設定
- `nginx.conf` - Nginxリバースプロキシ設定

### デプロイ手順

1. **サーバーにSSH接続**
```bash
ssh user@your-server-ip
```

2. **Dockerインストール**
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
sudo usermod -aG docker $USER
```

3. **プロジェクトをクローン**
```bash
git clone [your-repo-url]
cd crypto-volume-checker
```

4. **Docker Composeで起動**
```bash
docker-compose up -d
```

5. **ログ確認**
```bash
docker-compose logs -f
```

## 方法2: Render.com（無料枠あり・簡単）

### 手順

1. [Render.com](https://render.com)にサインアップ
2. GitHubリポジトリを連携
3. `render.yaml`ファイルを使って自動デプロイ
4. 環境変数を設定

### メリット
- 無料枠あり（月750時間）
- 自動デプロイ
- SSL証明書自動発行

## 方法3: Railway.app（最も簡単）

### 手順

1. [Railway.app](https://railway.app)にサインアップ
2. GitHubリポジトリを連携
3. "Deploy"ボタンをクリックするだけ

### メリット
- ワンクリックデプロイ
- 自動スケーリング
- $5/月から

## 方法4: Vercel + Heroku

### フロントエンド（Vercel）

1. [Vercel](https://vercel.com)にサインアップ
2. GitHubリポジトリを連携
3. Root directoryを`frontend`に設定
4. デプロイ

### バックエンド（Heroku）

1. Heroku CLIをインストール
```bash
brew install heroku/brew/heroku
```

2. Herokuにログイン
```bash
heroku login
heroku create your-app-name
```

3. Procfileを作成
```bash
echo "web: node backend/dist/index.js" > Procfile
```

4. デプロイ
```bash
git push heroku main
```

## 環境変数の設定

各プラットフォームで以下の環境変数を設定：

### バックエンド
- `NODE_ENV=production`
- `PORT=5000`

### フロントエンド  
- `REACT_APP_API_URL=https://your-backend-url.com`

## 本番環境での注意点

1. **CORS設定**
   - `backend/src/index.ts`でCORSの許可URLを本番URLに更新

2. **WebSocket設定**
   - フロントエンドのWebSocket接続URLを本番URLに更新

3. **セキュリティ**
   - APIキーなどの機密情報は環境変数で管理
   - Rate limitingの実装を検討

4. **モニタリング**
   - PM2やDatadogなどでアプリケーション監視
   - ログ収集の設定

## トラブルシューティング

### ポート関連のエラー
```bash
# ポートが使用中の場合
sudo lsof -i :5000
sudo kill -9 [PID]
```

### メモリ不足
```bash
# Node.jsのメモリ上限を増やす
NODE_OPTIONS="--max-old-space-size=4096" node dist/index.js
```

### SSL証明書
- Let's Encryptで無料SSL証明書を取得
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```