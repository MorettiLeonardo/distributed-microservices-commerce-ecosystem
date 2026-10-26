import { createLogger as createServiceLogger, type Logger } from '@ecommerce/logger';

export type { Logger };

export function createLogger(options: { level: string; enabled?: boolean }): Logger {
  return createServiceLogger({ ...options, service: 'catalog' });
}
