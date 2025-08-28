#!/bin/bash

# AWS EC2 t2.micro での最適化セットアップ

# 1. スワップ領域を追加（メモリ不足対策）
sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# 2. Node.js メモリ制限設定
export NODE_OPTIONS="--max-old-space-size=512"

# 3. PM2でプロセス管理（メモリ監視付き）
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# 4. CloudFlareでCDN（S3の転送料金対策）
# フロントエンドをS3に配置してCloudFlare経由で配信