import express from 'express';
import { VolumeRankingController } from '../controllers/volumeRankingController';

const router = express.Router();
const volumeRankingController = new VolumeRankingController();

router.get('/top20', volumeRankingController.getTop20.bind(volumeRankingController));
router.get('/binance', volumeRankingController.getBinanceRanking.bind(volumeRankingController));
router.get('/upbit', volumeRankingController.getUpbitRanking.bind(volumeRankingController));

export default router;