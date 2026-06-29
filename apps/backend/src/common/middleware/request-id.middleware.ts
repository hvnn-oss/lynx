import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

export function requestId() {
  return (req: Request, res: Response, next: NextFunction) => {
    const incomingId = req.headers['x-request-id']?.toString().trim();
    const id = incomingId || randomUUID();

    req.headers['x-request-id'] = id;
    res.setHeader('x-request-id', id);
    next();
  };
}
