import { Router } from 'express';
import { getTopDeviations } from '../controllers/priceDeviationController';

const router = Router();

router.get('/top', getTopDeviations);

export default router;