import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { Sequelize } from 'sequelize';
import { createDatabase } from '../../src/adapters/out/persistence/database.js';
import { createMigrator } from '../../src/adapters/out/persistence/migrator.js';

export type TestPostgres = {
  sequelize: Sequelize;
  /** Empties every table, keeping the schema. */
  truncate: () => Promise<void>;
  stop: () => Promise<void>;
};

/** A throwaway Postgres (same image as compose) with the real migrations applied. */
export async function startPostgres(): Promise<TestPostgres> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer(
    'postgres:18-alpine',
  ).start();
  const sequelize = createDatabase(container.getConnectionUri());
  await createMigrator(sequelize).up();

  return {
    sequelize,
    truncate: async () => {
      await sequelize.query('TRUNCATE users, sessions, one_time_tokens CASCADE');
    },
    stop: async () => {
      await sequelize.close();
      await container.stop();
    },
  };
}
