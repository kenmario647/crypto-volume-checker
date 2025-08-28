import { Router } from 'express';
import { PriceDeviationHistoryController } from '../controllers/priceDeviationHistoryController';

const router = Router();
const controller = new PriceDeviationHistoryController();

// 利用可能なシンボル一覧を取得
// GET /api/price-deviation-history/meta/symbols
router.get('/meta/symbols', controller.getAvailableSymbols);

// データ収集状況を取得
// GET /api/price-deviation-history/meta/status
router.get('/meta/status', controller.getCollectionStatus);

// 複数シンボルの最新データを取得
// GET /api/price-deviation-history/latest?symbols=BTC,ETH,SOL
router.get('/latest', controller.getLatestData);

// 特定のシンボルの履歴データを取得
// GET /api/price-deviation-history/:symbol?limit=50
router.get('/:symbol', controller.getSymbolHistory);

// 古いデータのクリーンアップを手動実行
// POST /api/price-deviation-history/cleanup
router.post('/cleanup', controller.cleanupOldData);

export default router;