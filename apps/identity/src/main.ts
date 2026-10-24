import { SNSClient } from '@aws-sdk/client-sns';
import { SQSClient } from '@aws-sdk/client-sqs';
import type { JWK } from 'jose';
import { createApp } from './adapters/in/http/app.js';
import { createRedisClient } from './adapters/out/cache/redis.client.js';
import { RedisLoginAttemptLimiter } from './adapters/out/cache/redis.login-attempt-limiter.js';
import { SnsEventPublisher } from './adapters/out/messaging/sns.event-publisher.js';
import { SqsEmailSender } from './adapters/out/messaging/sqs.email-sender.js';
import { createDatabase } from './adapters/out/persistence/database.js';
import {
  createRepositories,
  SequelizeUnitOfWork,
} from './adapters/out/persistence/sequelize.unit-of-work.js';
import { BcryptPasswordHasher } from './adapters/out/security/bcrypt.password-hasher.js';
import { CryptoSecureTokenGenerator } from './adapters/out/security/crypto.secure-token-generator.js';
import { JoseAccessTokens } from './adapters/out/security/jose.access-tokens.js';
import { SystemClock } from './adapters/out/system/system.clock.js';
import { UuidV7IdGenerator } from './adapters/out/system/uuid-v7.id-generator.js';
import { GetCurrentUser } from './application/use-cases/get-current-user.use-case.js';
import { Login } from './application/use-cases/login.use-case.js';
import { Logout } from './application/use-cases/logout.use-case.js';
import { RefreshSession } from './application/use-cases/refresh-session.use-case.js';
import { RegisterUser } from './application/use-cases/register-user.use-case.js';
import { RequestPasswordReset } from './application/use-cases/request-password-reset.use-case.js';
import { ResetPassword } from './application/use-cases/reset-password.use-case.js';
import { VerifyEmail } from './application/use-cases/verify-email.use-case.js';
import { type Config, loadConfig } from './config.js';
import { createLogger } from './logger.js';

/** Composition root: the only place that knows concrete adapters (manual DI). */
async function main(config: Config): Promise<void> {
  const logger = createLogger({ level: config.logLevel });

  const sequelize = createDatabase(config.databaseUrl);
  const redis = createRedisClient(config.redisUrl);
  redis.on('error', (error) => logger.error({ err: error }, 'redis client error'));
  await redis.connect();

  // Credentials come from the SDK's default chain (env vars locally, an IAM role on AWS).
  const awsOptions = {
    region: config.aws.region,
    ...(config.aws.endpoint !== undefined && { endpoint: config.aws.endpoint }),
  };

  const clock = new SystemClock();
  const idGenerator = new UuidV7IdGenerator();
  const accessTokens = await JoseAccessTokens.fromPrivateJwk(config.jwt.privateKey as JWK, {
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
    ttlMs: config.jwt.accessTokenTtlMs,
    clock,
  });

  const ports = {
    ...createRepositories(),
    unitOfWork: new SequelizeUnitOfWork(sequelize),
    clock,
    idGenerator,
    passwordHasher: new BcryptPasswordHasher(config.bcryptCost),
    tokenGenerator: new CryptoSecureTokenGenerator(),
    accessTokenIssuer: accessTokens,
    loginAttemptLimiter: new RedisLoginAttemptLimiter(redis, clock),
    eventPublisher: new SnsEventPublisher(
      new SNSClient(awsOptions),
      config.aws.identityEventsTopicArn,
      idGenerator,
    ),
    emailSender: new SqsEmailSender(
      new SQSClient(awsOptions),
      config.aws.sendEmailQueueUrl,
      idGenerator,
      clock,
    ),
    sessionTtlMs: config.sessionTtlMs,
  };

  const app = createApp({
    useCases: {
      registerUser: new RegisterUser(ports),
      login: new Login(ports),
      refreshSession: new RefreshSession(ports),
      logout: new Logout(ports),
      verifyEmail: new VerifyEmail(ports),
      requestPasswordReset: new RequestPasswordReset(ports),
      resetPassword: new ResetPassword(ports),
      getCurrentUser: new GetCurrentUser(ports),
    },
    accessTokenVerifier: accessTokens,
    jwks: () => accessTokens.jwks(),
    readinessChecks: [
      { name: 'postgres', check: () => sequelize.authenticate() },
      {
        name: 'redis',
        check: async () => {
          await redis.ping();
        },
      },
    ],
    logger,
  });

  const server = app.listen(config.port, () => {
    logger.info({ port: config.port, env: config.env }, 'identity service listening');
  });

  // Stop accepting connections, let in-flight requests finish, then release connections.
  const shutdown = (signal: NodeJS.Signals) => {
    logger.info({ signal }, 'shutting down');
    server.close(async () => {
      await Promise.allSettled([sequelize.close(), redis.close()]);
      process.exit(0);
    });
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

try {
  await main(loadConfig());
} catch (error) {
  // The logger may not exist yet (e.g. invalid env), so write straight to stderr.
  process.stderr.write(
    `identity failed to start: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
}
