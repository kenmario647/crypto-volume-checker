# Oracle Cloud 永久無料枠でのデプロイ

## メリット
- **永久無料**（12ヶ月制限なし）
- ARM Ampere A1: 4 OCPU、24GB RAMまで無料
- 200GB ストレージ
- 10TB/月のデータ転送

## セットアップ手順

1. Oracle Cloudアカウント作成
   - https://www.oracle.com/cloud/free/
   - クレジットカード必要（課金はされない）

2. インスタンス作成
```bash
# ARM Ampere A1 Compute
- Shape: VM.Standard.A1.Flex
- OCPU: 2
- Memory: 12GB
- OS: Ubuntu 22.04
```

3. セキュリティルール設定
```bash
# Ingress Rules追加
- Port 80 (HTTP)
- Port 443 (HTTPS)
- Port 5000 (Backend API)
```

4. アプリケーションデプロイ
```bash
# SSH接続
ssh -i private_key ubuntu@your-instance-ip

# Docker インストール
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker ubuntu

# プロジェクトクローン
git clone your-repo
cd crypto-volume-checker

# Docker Compose起動
docker-compose up -d
```

## 注意点
- 初回登録時は地域選択が重要（東京リージョン推奨）
- ARM版のDockerイメージビルドが必要
- 無料枠の制限内で複数サービス運用可能