import { pino, type Logger } from 'pino';

export type { Logger };

/** Fields that must never reach a log line, wherever they appear (STYLE_GUIDE §11). */
const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.password',
  '*.newPassword',
  '*.refreshToken',
  '*.accessToken',
];

export function createLogger(options: { level: string; enabled?: boolean }): Logger {
  return pino({
    level: options.level,
    enabled: options.enabled ?? true,
    base: { service: 'identity' },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: { paths: REDACTED_PATHS, censor: '[REDACTED]' },
  });
}
