import { createLogger as createServiceLogger, type Logger } from '@ecommerce/logger';

export type { Logger };

/** Identity secrets, redacted on top of the auth headers every service hides (STYLE_GUIDE §11). */
const REDACTED_PATHS = ['*.password', '*.newPassword', '*.refreshToken', '*.accessToken'];

export function createLogger(options: { level: string; enabled?: boolean }): Logger {
  return createServiceLogger({ ...options, service: 'identity', redact: REDACTED_PATHS });
}
