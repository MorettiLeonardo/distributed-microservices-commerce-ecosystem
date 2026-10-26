import { createApp } from './adapters/in/http/app.js';
import { createRedisClient } from './adapters/out/cache/redis.client.js';
import { createDatabase } from './adapters/out/persistence/database.js';
import { type Config, loadConfig } from './config.js';
import { createLogger } from './logger.js';

/** Composition root: the only place that knows concrete adapters (manual DI). */
async function main(config: Config): Promise<void> {
  const logger = createLogger({ level: config.logLevel });

  const sequelize = createDatabase(config.databaseUrl);
  const redis = createRedisClient(config.redisUrl);
  redis.on('error', (error) => logger.error({ err: error }, 'redis client error'));
  await redis.connect();

  const app = createApp({
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
    logger.info({ port: config.port, env: config.env }, 'catalog service listening');
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
    `catalog failed to start: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
}
