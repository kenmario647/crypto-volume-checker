import { Router } from 'express';
import { getTopDeviations, getSymbolDebug } from '../controllers/priceDeviationController';

const router = Router();

router.get('/top', getTopDeviations);
router.get('/debug/:symbol', getSymbolDebug);

export default router;