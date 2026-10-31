import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3002),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  REDIS_URL: z.url({ protocol: /^rediss?$/ }),

  // Access tokens are verified locally against identity's public keys (ADR 0013).
  IDENTITY_JWKS_URL: z.url({ protocol: /^https?$/ }),
  JWT_ISSUER: z.string().min(1).default('ecommerce-identity'),
  JWT_AUDIENCE: z.string().min(1).default('ecommerce'),
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
    auth: {
      jwksUrl: vars.IDENTITY_JWKS_URL,
      issuer: vars.JWT_ISSUER,
      audience: vars.JWT_AUDIENCE,
    },
  };
}
