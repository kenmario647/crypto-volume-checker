import express from 'express';
import { ExchangeController } from '../controllers/exchangeController';

const router = express.Router();
const exchangeController = new ExchangeController();

router.get('/data', exchangeController.getExchangeData.bind(exchangeController));
router.get('/status', exchangeController.getExchangeStatus.bind(exchangeController));
router.get('/:exchange/volume', exchangeController.getExchangeVolume.bind(exchangeController));

export default router;