import { Router } from 'express';
import { SpotPerpVolumeController } from '../controllers/spotPerpVolumeController';
import { SpotPerpVolumeService } from '../services/spotPerpVolumeService';

const router = Router();
const spotPerpVolumeService = SpotPerpVolumeService.getInstance();
const spotPerpVolumeController = new SpotPerpVolumeController(spotPerpVolumeService);

router.get('/spot', (req, res) => spotPerpVolumeController.getSpotVolumes(req, res));
router.get('/perp', (req, res) => spotPerpVolumeController.getPerpVolumes(req, res));
router.get('/combined', (req, res) => spotPerpVolumeController.getCombinedVolumes(req, res));

export default router;