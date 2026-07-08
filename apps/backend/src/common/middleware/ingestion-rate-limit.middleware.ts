import { Logger } from '@nestjs/common';
import { ERROR_CODES } from '@repo/constants';
import { createHash } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import Redis from 'ioredis';

const logger = new Logger('IngestionRateLimit');
const defaultMaxRequestsPerMinute = 600;

export function ingestionRateLimit(redis?: Redis) {
  const maxRequests = parsePositiveInt(
    process.env.INGEST_RATE_LIMIT_PER_MINUTE,
    defaultMaxRequestsPerMinute,
  );
  const windowMs = 60_000;
  const windowSeconds = Math.ceil(windowMs / 1000);
  const buckets = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.path.startsWith('/openapi/v1/events')) {
      next();
      return;
    }

    if (redis) {
      void applyRedisRateLimit(redis, req, res, next, {
        maxRequests,
        windowSeconds,
      });
      return;
    }

    const now = Date.now();
    const key = getRateLimitKey(req);
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

async function applyRedisRateLimit(
  redis: Redis,
  req: Request,
  res: Response,
  next: NextFunction,
  options: { maxRequests: number; windowSeconds: number },
) {
  const key = `rate:ingest:${getRateLimitKey(req)}`;

  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, options.windowSeconds);
    }

    if (count > options.maxRequests) {
      res.setHeader('Retry-After', options.windowSeconds.toString());
      res.status(429).json({
        error_code: ERROR_CODES.INVALID_INPUT,
        message: 'Ingestion rate limit exceeded.',
      });
      return;
    }

    next();
  } catch (error) {
    // 수집 안정성이 우선이므로 Redis 장애 시 rate limit만 우회합니다.
    logger.warn('Redis ingestion rate limit failed open.', error);
    next();
  }
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  if (!value) return fallback;

  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getRateLimitKey(req: Request) {
  const rawKey =
    req.headers['x-api-key']?.toString() ||
    req.ip ||
    req.socket.remoteAddress ||
    'unknown';

  return createHash('sha256').update(rawKey).digest('hex');
}
