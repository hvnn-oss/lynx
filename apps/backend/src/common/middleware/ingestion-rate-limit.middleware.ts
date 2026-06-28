import { ERROR_CODES } from '@repo/constants';
import { NextFunction, Request, Response } from 'express';

export function ingestionRateLimit() {
  const maxRequests = Number(process.env.INGEST_RATE_LIMIT_PER_MINUTE ?? 600);
  const windowMs = 60_000;
  const buckets = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.path.startsWith('/openapi/v1/events')) {
      next();
      return;
    }

    const now = Date.now();
    const key =
      req.headers['x-api-key']?.toString() ||
      req.ip ||
      req.socket.remoteAddress ||
      'unknown';
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    bucket.count += 1;
    if (bucket.count > maxRequests) {
      res.status(429).json({
        error_code: ERROR_CODES.INVALID_INPUT,
        message: 'Ingestion rate limit exceeded.',
      });
      return;
    }

    next();
  };
}
