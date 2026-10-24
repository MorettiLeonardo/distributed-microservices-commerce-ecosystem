import { z } from 'zod';

const DAY_MS = 24 * 60 * 60 * 1000;

const jsonObject = z.string().transform((raw, ctx) => {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) return parsed as Record<string, unknown>;
  } catch {
    // reported below
  }
  ctx.addIssue({ code: 'custom', message: 'Must be a JSON object' });
  return z.NEVER;
});

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  REDIS_URL: z.url({ protocol: /^rediss?$/ }),

  AWS_REGION: z.string().min(1),
  /** Only for emulators (Floci). Unset against real AWS. */
  AWS_ENDPOINT_URL: z.url().optional(),
  IDENTITY_EVENTS_TOPIC_ARN: z.string().startsWith('arn:aws:sns:'),
  SEND_EMAIL_QUEUE_URL: z.url(),

  /** ES256 private key as a JWK (JSON). Generate one with `pnpm --filter @ecommerce/identity keys:generate`. */
  JWT_PRIVATE_KEY: jsonObject,
  JWT_ISSUER: z.string().min(1).default('ecommerce-identity'),
  JWT_AUDIENCE: z.string().min(1).default('ecommerce'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
  BCRYPT_COST: z.coerce.number().int().min(4).max(15).default(12),
});

export type Config = ReturnType<typeof loadConfig>;

/** Validates the environment at startup: an invalid env stops the process (fail-fast). */
export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const result = EnvSchema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(result.error)}`);
  }
  const vars = result.data;

  return {
    env: vars.NODE_ENV,
    port: vars.PORT,
    logLevel: vars.LOG_LEVEL,
    databaseUrl: vars.DATABASE_URL,
    redisUrl: vars.REDIS_URL,
    aws: {
      region: vars.AWS_REGION,
      endpoint: vars.AWS_ENDPOINT_URL,
      identityEventsTopicArn: vars.IDENTITY_EVENTS_TOPIC_ARN,
      sendEmailQueueUrl: vars.SEND_EMAIL_QUEUE_URL,
    },
    jwt: {
      privateKey: vars.JWT_PRIVATE_KEY,
      issuer: vars.JWT_ISSUER,
      audience: vars.JWT_AUDIENCE,
      accessTokenTtlMs: vars.ACCESS_TOKEN_TTL_SECONDS * 1000,
    },
    sessionTtlMs: vars.SESSION_TTL_DAYS * DAY_MS,
    bcryptCost: vars.BCRYPT_COST,
  };
}
