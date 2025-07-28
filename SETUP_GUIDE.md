# Crypto Volume Checker セットアップガイド

## 🚀 クイックスタート

### 1. 必要要件
- Node.js 18+ 
- npm または yarn

### 2. プロジェクトセットアップ

```bash
# プロジェクトディレクトリに移動
cd crypto-volume-checker

# 全ての依存関係をインストール
npm run install:all

# 環境変数設定
cp backend/.env.example backend/.env
```

### 3. 開発サーバー起動

```bash
# フロントエンドとバックエンドを同時起動
npm run dev
```

または個別に起動：

```bash
# バックエンドのみ起動 (ポート: 5000)
npm run dev:backend

# フロントエンドのみ起動 (ポート: 3000)
npm run dev:frontend
```

### 4. アクセス

- **フロントエンド**: http://localhost:3000
- **バックエンドAPI**: http://localhost:5000
- **ヘルスチェック**: http://localhost:5000/health

## 📁 プロジェクト構造

```
crypto-volume-checker/
├── frontend/                 # React TypeScript アプリケーション
│   ├── src/
│   │   ├── components/      # 再利用可能コンポーネント
│   │   ├── pages/          # ページコンポーネント
│   │   └── App.tsx         # メインアプリケーション
│   └── package.json
├── backend/                 # Node.js Express API
│   ├── src/
│   │   ├── controllers/    # APIコントローラー
│   │   ├── services/       # ビジネスロジック
│   │   ├── routes/         # APIルート定義
│   │   ├── middleware/     # Express ミドルウェア
│   │   ├── types/          # TypeScript型定義
│   │   └── utils/          # ユーティリティ関数
│   └── package.json
├── package.json            # ルートパッケージ設定
└── README.md
```

## 🔧 主要機能

### フロントエンド機能
- ✅ リアルタイムダッシュボード
- ✅ 取引量チャート表示
- ✅ モメンタム分析テーブル
- ✅ 取引所データ比較
- ✅ **リアルタイム出来高ランキング（Top 20）**
- ✅ ダークテーマUI
- ✅ レスポンシブデザイン

### バックエンド機能
- ✅ RESTful API
- ✅ WebSocket リアルタイム通信
- ✅ **Binance WebSocket リアルタイム出来高取得**
- ✅ **Upbit WebSocket リアルタイム出来高取得**
- ✅ **分間隔での出来高データ更新**
- ✅ Binance API 連携
- ✅ Upbit API 連携
- ✅ エラーハンドリング
- ✅ ログ機能

### API エンドポイント

#### Volume API
- `GET /api/volume/24h` - 24時間取引量取得
- `GET /api/volume/chart` - 取引量チャートデータ
- `GET /api/volume/change` - 取引量変化率

#### Momentum API
- `GET /api/momentum/top5` - トップ5モメンタム
- `GET /api/momentum/gainers` - 上昇率ランキング
- `GET /api/momentum/losers` - 下落率ランキング

#### Exchange API
- `GET /api/exchange/data` - 全取引所データ
- `GET /api/exchange/status` - 取引所ステータス
- `GET /api/exchange/:exchange/volume` - 個別取引所データ

#### Volume Ranking API (New!)
- `GET /api/volume-ranking/top20` - リアルタイム出来高トップ20
- `GET /api/volume-ranking/binance` - Binance出来高ランキング
- `GET /api/volume-ranking/upbit` - Upbit出来高ランキング

## 🔌 WebSocket接続

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5000');

// データ購読
socket.emit('subscribe', { type: 'volume' });
socket.emit('subscribe', { type: 'momentum' });
socket.emit('subscribe', { type: 'exchange' });

// リアルタイムデータ受信
socket.on('volume-update', (data) => {
  console.log('Volume update:', data);
});

socket.on('momentum-update', (data) => {
  console.log('Momentum update:', data);
});

socket.on('exchange-update', (data) => {
  console.log('Exchange update:', data);
});

socket.on('volume-ranking-update', (data) => {
  console.log('Volume ranking update:', data);
});
```

## 🛠 開発コマンド

```bash
# 開発サーバー起動
npm run dev

# プロダクションビルド
npm run build

# 依存関係クリーンアップ
npm run clean

# 全て再インストール
npm run clean && npm run install:all
```

## 🔍 トラブルシューティング

### ポートが使用中の場合
```bash
# ポート使用状況確認
lsof -ti:3000
lsof -ti:5000

# プロセス終了
kill -9 $(lsof -ti:3000)
kill -9 $(lsof -ti:5000)
```

### API接続エラーの場合
1. バックエンドサーバーが起動しているか確認
2. ヘルスチェックエンドポイントにアクセス: `http://localhost:5000/health`
3. CORS設定を確認
4. ログファイル `backend/logs/` を確認

### WebSocket接続エラーの場合
1. フロントエンドのSocket.ioクライアントバージョン確認
2. ブラウザの開発者ツールで接続ログ確認
3. ファイアウォール設定確認

## 🌟 今後の拡張予定

- [ ] 多言語対応（日本語・英語）
- [ ] ダークモード・ライトモード切り替え
- [ ] 価格アラート機能
- [ ] データエクスポート機能
- [ ] モバイル対応強化
- [ ] Docker化
- [ ] デプロイ自動化

## 📄 ライセンス

MIT License