import { Request, Response, NextFunction } from 'express';

export const validateCronSecret = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const cronSecret = req.headers['x-cron-secret'] || req.headers['authorization'];
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    console.warn('CRON_SECRET not configured');
    res.status(500).json({ error: 'CRON_SECRET not configured' });
    return;
  }

  // Check header format (could be "Bearer <secret>" or just "<secret>")
  const providedSecret = cronSecret?.toString().replace('Bearer ', '');

  if (providedSecret !== expectedSecret) {
    res.status(401).json({ error: 'Unauthorized - Invalid cron secret' });
    return;
  }

  next();
};
