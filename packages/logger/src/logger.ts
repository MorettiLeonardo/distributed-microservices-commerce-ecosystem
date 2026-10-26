import { type DestinationStream, pino, type Logger } from 'pino';

export type { Logger };

/** Fields no service may ever log (STYLE_GUIDE §11). Services add their own on top. */
const BASE_REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
];

export type LoggerOptions = {
  /** Value of the `service` field on every line. */
  service: string;
  level: string;
  enabled?: boolean;
  /** Extra paths to redact, e.g. `*.password`. */
  redact?: readonly string[];
  /** Defaults to stdout; tests pass a stream to inspect the output. */
  destination?: DestinationStream;
};

export function createLogger(options: LoggerOptions): Logger {
  const config = {
    level: options.level,
    enabled: options.enabled ?? true,
    base: { service: options.service },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: { paths: [...BASE_REDACTED_PATHS, ...(options.redact ?? [])], censor: '[REDACTED]' },
  };
  return options.destination ? pino(config, options.destination) : pino(config);
}
