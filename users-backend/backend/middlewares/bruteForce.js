import { logger } from '../lib/logger.js';

const bruteForceStore = new Map();

export function bruteForce(req, res, next) {
  const ip = req.ip;
  const email = req.body?.email || '';
  const key = `${ip}:${email.toLowerCase()}`;
  const now = Date.now();
  const lockoutDuration = 15 * 60 * 1000;

  let record = bruteForceStore.get(key);
  if (!record) {
    record = { failures: 0, lockedUntil: 0 };
    bruteForceStore.set(key, record);
  }

  if (record.lockedUntil > now) {
    const retryAfter = Math.ceil((record.lockedUntil - now) / 1000);
    logger.warn({ ip, email: email.substring(0, 2) + '***' + email.substring(email.indexOf('@')), retryAfter }, 'Brute force lockout');
    return res.status(403).json({
      code: 'BRUTE_FORCE_LOCKED',
      message: 'Too many failed attempts. Please try again later.',
      retryAfter,
    });
  }

  const originalSend = res.send;
  res.send = function (body) {
    if (res.statusCode === 401) {
      record.failures++;
      if (record.failures >= 5) {
        record.lockedUntil = now + lockoutDuration;
        logger.warn({ ip, email: email.substring(0, 2) + '***' + email.substring(email.indexOf('@')), failures: record.failures }, 'Brute force threshold reached');
      }
    } else if (res.statusCode === 200) {
      record.failures = 0;
      record.lockedUntil = 0;
    }
    return originalSend.call(this, body);
  };

  next();
}

setInterval(() => {
  const now = Date.now();
  for (const [key, record] of bruteForceStore.entries()) {
    if (record.lockedUntil < now && record.failures === 0) {
      bruteForceStore.delete(key);
    }
  }
}, 60000);