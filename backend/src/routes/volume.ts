import express from 'express';
import { VolumeController } from '../controllers/volumeController';

const router = express.Router();
const volumeController = new VolumeController();

router.get('/24h', volumeController.getVolume24h.bind(volumeController));
router.get('/chart', volumeController.getVolumeChart.bind(volumeController));
router.get('/change', volumeController.getVolumeChange.bind(volumeController));
router.get('/symbol/:exchange/:symbol', volumeController.getSymbolVolumeChart.bind(volumeController));

export default router;