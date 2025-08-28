# AWS デプロイガイド

## 🚀 セットアップ手順

### 1. AWS EC2インスタンス作成
```bash
# Amazon Linux 2 AMI を選択
# インスタンスタイプ: t3.micro (無料枠) または t3.small
# セキュリティグループ: ポート5000を開放
# SSH: ポート22を開放
```

### 2. セキュリティグループ設定
```
インバウンドルール:
- HTTP: ポート5000, ソース: 0.0.0.0/0
- SSH: ポート22, ソース: あなたのIP
```

### 3. バックエンドデプロイ
```bash
# デプロイスクリプト実行
./aws-deploy.sh ec2-user@YOUR_EC2_PUBLIC_IP ~/.ssh/your-aws-key.pem
```

### 4. フロントエンド設定
```bash
# AWS用環境変数設定
cp frontend/.env.aws frontend/.env

# .envファイルを編集してAWSのパブリックIPを設定
REACT_APP_API_URL=http://YOUR_AWS_PUBLIC_IP:5000
```

### 5. ローカルフロントエンド起動
```bash
cd frontend
npm start
# http://localhost:3000 でアクセス
```

## 🔧 動作確認

### バックエンドチェック
```bash
curl http://YOUR_AWS_PUBLIC_IP:5000/health
# 期待結果: {"status":"OK","timestamp":"...","service":"crypto-volume-checker-api"}
```

### API動作確認
```bash
curl http://YOUR_AWS_PUBLIC_IP:5000/api/volume-ranking/binance
```

## 📊 モニタリング

### ログ確認
```bash
ssh -i your-key.pem ec2-user@YOUR_AWS_PUBLIC_IP
cd ~/crypto-volume-checker-backend
docker-compose -f docker-compose.aws.yml logs -f
```

### コンテナ状態確認
```bash
docker-compose -f docker-compose.aws.yml ps
```

## ⚠️ 注意事項

1. **Bybit API**: 本番APIキーを使用
2. **CORS**: フロントエンドURLを適切に設定
3. **セキュリティ**: APIキーを環境変数で管理
4. **コスト**: EC2インスタンス料金に注意

## 🔄 アップデート方法
```bash
# 同じデプロイスクリプトで更新可能
./aws-deploy.sh ec2-user@YOUR_AWS_PUBLIC_IP ~/.ssh/your-aws-key.pem
```