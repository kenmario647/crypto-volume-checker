import express from 'express';
import { TicksController } from '../controllers/ticksController';

const router = express.Router();
const ticksController = new TicksController();

router.get('/current', ticksController.getCurrentTicks.bind(ticksController));
router.get('/top-movers', ticksController.getTopMovers.bind(ticksController));
router.get('/:exchange/:symbol', ticksController.getSymbolTicks.bind(ticksController));

export default router;