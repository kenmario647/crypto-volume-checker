import express from 'express';
import { FrOiController } from '../controllers/frOiController';

const router = express.Router();
const frOiController = new FrOiController();

router.get('/alerts', frOiController.getAlerts.bind(frOiController));
router.get('/current', frOiController.getCurrentData.bind(frOiController));

export default router;