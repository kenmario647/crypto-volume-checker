import express from 'express';
import { MomentumController } from '../controllers/momentumController';

const router = express.Router();
const momentumController = new MomentumController();

router.get('/top5', momentumController.getTop5Momentum.bind(momentumController));
router.get('/gainers', momentumController.getTopGainers.bind(momentumController));
router.get('/losers', momentumController.getTopLosers.bind(momentumController));

export default router;