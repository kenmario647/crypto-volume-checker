# AWS サービス比較（Crypto Volume Checker用）

## 料金比較

| サービス | 月額料金 | メモリ | CPU | データ転送 | 管理の手間 |
|---------|---------|--------|-----|------------|-----------|
| **Lightsail $10** | $10 | 2GB | 1vCPU | 3TB込み | 簡単 |
| **Lightsail $20** | $20 | 4GB | 2vCPU | 4TB込み | 簡単 |
| EC2 t3.small | $15 | 2GB | 2vCPU | 別途課金 | 複雑 |
| EC2 t3.medium | $30 | 4GB | 2vCPU | 別途課金 | 複雑 |
| ECS Fargate | $36+ | 1GB×2 | 0.5×2 | 別途課金 | 中程度 |
| Elastic Beanstalk | $15+ | 2GB | 2vCPU | 別途課金 | 簡単 |

## 推奨: AWS Lightsail $20プラン

### メリット
- **固定料金**（追加料金なし）
- **4GB RAM**（安定動作）
- **4TB転送量込み**
- **自動バックアップ**（$2/月）
- **ロードバランサー**（$18/月）※必要な場合

### Lightsailセットアップ手順

```bash
# 1. Lightsailインスタンス作成
- プラン: $20/月
- OS: Ubuntu 22.04
- リージョン: ap-northeast-1（東京）

# 2. SSH接続してセットアップ
ssh -i LightsailDefaultKey.pem ubuntu@your-ip

# 3. 必要なソフトウェアインストール
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs nginx git

# 4. アプリケーションデプロイ
git clone your-repo-url
cd crypto-volume-checker
npm run install:all
npm run build

# 5. PM2でプロセス管理
sudo npm install -g pm2
pm2 start ecosystem.config.js
pm2 startup systemd
pm2 save

# 6. Nginx設定
sudo nano /etc/nginx/sites-available/default
# nginx.confの内容をコピー
sudo nginx -s reload
```

## EC2を選ぶ場合の最適構成

### EC2 t3.medium + S3 + CloudFront
```yaml
# 構成
- EC2: t3.medium (4GB RAM) - $30/月
- S3: Frontend静的ホスティング - $1/月
- CloudFront: CDN - $5/月
- Route53: DNS - $0.5/月
- データ転送: $5-10/月

合計: 約$42-47/月
```

### 必要なIAMポリシー
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::your-bucket/*",
        "arn:aws:s3:::your-bucket"
      ]
    }
  ]
}
```

## コスト最適化のポイント

### 1. Reserved Instance（1年契約）
- EC2料金が**40%割引**
- t3.small: $15/月 → $9/月
- t3.medium: $30/月 → $18/月

### 2. Savings Plans（1-3年契約）
- **最大72%割引**
- 柔軟性あり（インスタンスタイプ変更可）

### 3. スポットインスタンス（開発環境のみ）
- **最大90%割引**
- ただし中断リスクあり

## Auto Scaling設定（本番環境）

```yaml
# Auto Scaling Group設定
MinSize: 1
MaxSize: 3
DesiredCapacity: 1
TargetCPUUtilization: 70%

# スケーリングポリシー
- CPU使用率70%超過: インスタンス追加
- CPU使用率30%未満: インスタンス削減
```

## 監視とアラート

### CloudWatch設定
```bash
# 基本メトリクス（無料）
- CPU使用率
- ネットワーク入出力
- ディスク使用率

# カスタムメトリクス（$0.30/月）
- メモリ使用率
- Node.jsプロセス監視
- API応答時間
```

### アラート設定
- CPU > 80%: メール通知
- メモリ > 90%: 自動再起動
- ディスク > 80%: ログローテーション

## 結論

### 初心者・小規模運用
**AWS Lightsail $20プラン**
- 固定料金で予算管理しやすい
- 設定が簡単
- 十分なスペック

### 中規模・本番運用
**EC2 t3.medium + Reserved Instance**
- 月額$18（1年契約）
- Auto Scaling対応
- 詳細な監視可能

### 大規模・エンタープライズ
**EKS (Kubernetes) or ECS**
- 完全な自動スケーリング
- マイクロサービス対応
- 月額$100+