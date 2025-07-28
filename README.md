# Crypto Volume Checker

暗号通貨取引量とトレーディング分析を行うWebアプリケーション

## 機能

- **リアルタイム取引量監視**: 主要取引所の取引量データを取得
- **モメンタム分析**: Top5銘柄のモメンタム追跡
- **価格・出来高分析**: 価格とボリュームの乖離分析
- **多取引所対応**: Binance、Upbit等の主要取引所データ統合
- **チャート表示**: リアルタイムチャートとテクニカル分析

## 技術スタック

### フロントエンド
- React 18
- TypeScript
- Chart.js (チャート表示)
- Material-UI (UI コンポーネント)
- WebSocket (リアルタイム通信)

### バックエンド
- Node.js
- Express
- WebSocket
- 取引所API連携 (Binance, Upbit, etc.)

## 開発環境セットアップ

### 必要要件
- Node.js 18+
- npm または yarn

### インストール手順

1. リポジトリクローン
```bash
git clone <repository-url>
cd crypto-volume-checker
```

2. フロントエンド依存関係インストール
```bash
cd frontend
npm install
```

3. バックエンド依存関係インストール
```bash
cd ../backend
npm install
```

4. 環境変数設定
```bash
cp .env.example .env
# .envファイルを編集してAPI キーを設定
```

5. 開発サーバー起動
```bash
# バックエンド
cd backend
npm run dev

# フロントエンド（別ターミナル）
cd frontend
npm start
```

## API 設計

### エンドポイント
- `GET /api/volume/24h` - 24時間取引量取得
- `GET /api/momentum/top5` - トップ5モメンタム取得
- `GET /api/exchanges/data` - 取引所別データ取得
- `WebSocket /ws` - リアルタイムデータ配信

## ライセンス

MIT License