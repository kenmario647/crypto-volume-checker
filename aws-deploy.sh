#!/bin/bash

# AWS EC2へのデプロイスクリプト
# 使用方法: ./aws-deploy.sh <EC2_HOST> <KEY_FILE>

if [ $# -lt 2 ]; then
    echo "Usage: $0 <EC2_HOST> <KEY_FILE>"
    echo "Example: $0 ec2-user@3.112.23.45 ~/.ssh/aws-key.pem"
    exit 1
fi

EC2_HOST=$1
KEY_FILE=$2

echo "🚀 Deploying crypto-volume-checker backend to AWS..."

# 1. ファイルをEC2にアップロード
echo "📁 Uploading files to EC2..."
scp -i $KEY_FILE -r backend/ $EC2_HOST:~/crypto-volume-checker-backend/

# 2. EC2でDockerビルド&起動
echo "🐳 Building and starting Docker container on EC2..."
ssh -i $KEY_FILE $EC2_HOST << 'EOF'
    cd ~/crypto-volume-checker-backend
    
    # Docker & Docker Compose インストール確認
    if ! command -v docker &> /dev/null; then
        echo "Installing Docker..."
        sudo yum update -y
        sudo yum install -y docker
        sudo systemctl start docker
        sudo systemctl enable docker
        sudo usermod -a -G docker ec2-user
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        echo "Installing Docker Compose..."
        sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose
    fi
    
    # 既存コンテナ停止
    docker-compose -f docker-compose.aws.yml down || true
    
    # 新しいコンテナ起動
    docker-compose -f docker-compose.aws.yml up -d --build
    
    echo "✅ Backend deployed successfully!"
    echo "🔗 Backend URL: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):5000"
    echo "🏥 Health Check: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):5000/health"
EOF

echo "🎉 Deployment completed!"