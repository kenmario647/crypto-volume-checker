# Render Starter ($7/月) で動かすための最適化

## メモリ削減設定

### 1. Node.js メモリ制限
```javascript
// package.json のstart scriptを修正
"start": "NODE_OPTIONS='--max-old-space-size=400' node dist/index.js"
```

### 2. 取引所APIの最適化
```javascript
// 同時接続数を制限
const MAX_CONCURRENT_REQUESTS = 3; // 9から3に削減

// キャッシュサイズ制限
const MAX_CACHE_SIZE = 100; // シンボル数制限
```

### 3. WebSocket接続の最適化
```javascript
// 不要なシンボルの購読解除
const TOP_SYMBOLS_ONLY = 50; // 上位50銘柄のみ

// ping/pongインターバル延長
const PING_INTERVAL = 60000; // 30秒から60秒に
```

### 4. ログの最小化
```javascript
// production環境でログレベル変更
logger.level = process.env.NODE_ENV === 'production' ? 'error' : 'info';
```

### 5. ガベージコレクション強制
```javascript
// 定期的なメモリ解放
setInterval(() => {
  if (global.gc) {
    global.gc();
  }
}, 60000);

// 起動時: node --expose-gc dist/index.js
```

## Render設定ファイル（最適化版）

```yaml
# render.yaml
services:
  - type: web
    name: crypto-backend
    plan: starter  # $7/月
    runtime: node
    rootDir: backend
    buildCommand: npm install && npm run build
    startCommand: NODE_OPTIONS='--max-old-space-size=400 --expose-gc' node dist/index.js
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 5000
      - key: MAX_SYMBOLS
        value: 50
      - key: CACHE_DURATION
        value: 300000
    healthCheckPath: /api/health
    autoDeploy: true
```

## メモリ使用量比較

| 設定 | メモリ使用量 | Starter対応 |
|------|-------------|------------|
| 現在（フル機能） | 350-530MB | ❌ |
| 最適化後 | 250-400MB | ⭚ ギリギリ |
| 機能制限版 | 200-300MB | ✅ |

## 機能制限版の変更点

1. **取引所を5つに削減**
   - Binance, Bybit, OKX, Gate, Bitget のみ

2. **更新頻度を下げる**
   - 価格: 1分 → 2分
   - 出来高: 5分 → 10分

3. **履歴データ制限**
   - 24時間 → 6時間

## 結論

### Render Starter ($7) 
- **最適化必須**
- **機能制限あり**
- **不安定リスク**

### Render Standard ($25)
- **安定動作**
- **フル機能**
- **余裕あり**

### 推奨
- 本番環境: **Standard ($25)**
- 開発/テスト: **Starter ($7)**