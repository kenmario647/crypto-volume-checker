import express from 'express';
import { VolumeRankingController } from '../controllers/volumeRankingController';

const router = express.Router();
const volumeRankingController = new VolumeRankingController();

router.get('/top20', volumeRankingController.getTop20.bind(volumeRankingController));
router.get('/binance', volumeRankingController.getBinanceRanking.bind(volumeRankingController));
router.get('/binance-spot', volumeRankingController.getBinanceSpotRanking.bind(volumeRankingController));
router.get('/upbit', volumeRankingController.getUpbitRanking.bind(volumeRankingController));
router.get('/bybit', volumeRankingController.getBybitRanking.bind(volumeRankingController));
router.get('/okx', volumeRankingController.getOkxRanking.bind(volumeRankingController));
router.get('/gateio', volumeRankingController.getGateioRanking.bind(volumeRankingController));
router.get('/bitget', volumeRankingController.getBitgetRanking.bind(volumeRankingController));
router.get('/mexc', volumeRankingController.getMexcRanking.bind(volumeRankingController));
router.get('/bithumb', volumeRankingController.getBithumbRanking.bind(volumeRankingController));
router.get('/coinbase', volumeRankingController.getCoinbaseRanking.bind(volumeRankingController));

export default router;