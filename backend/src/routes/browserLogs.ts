import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';

const router = Router();

interface BrowserLog {
  level: string;
  timestamp: string;
  url: string;
  userAgent: string;
  args: string[];
}

router.post('/', (req: Request, res: Response) => {
  try {
    const { logs } = req.body;
    
    if (!Array.isArray(logs)) {
      return res.status(400).json({ error: 'Invalid logs format' });
    }

    logs.forEach((log: BrowserLog) => {
      const message = `[BROWSER ${log.level.toUpperCase()}] ${log.url} - ${log.args.join(' ')}`;
      
      switch (log.level) {
        case 'error':
          logger.error(message, {
            timestamp: log.timestamp,
            userAgent: log.userAgent,
            args: log.args
          });
          break;
        case 'warn':
          logger.warn(message, {
            timestamp: log.timestamp,
            userAgent: log.userAgent,
            args: log.args
          });
          break;
        case 'info':
          logger.info(message, {
            timestamp: log.timestamp,
            userAgent: log.userAgent,
            args: log.args
          });
          break;
        default:
          logger.info(message, {
            timestamp: log.timestamp,
            userAgent: log.userAgent,
            args: log.args
          });
      }
    });

    res.status(200).json({ success: true, count: logs.length });
  } catch (error) {
    logger.error('Error processing browser logs:', error);
    res.status(500).json({ error: 'Failed to process logs' });
  }
});

export default router;