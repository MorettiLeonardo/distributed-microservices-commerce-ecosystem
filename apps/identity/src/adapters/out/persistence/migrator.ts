import type { Sequelize } from 'sequelize';
import { SequelizeStorage, Umzug } from 'umzug';
import * as createIdentityTables from './migrations/0001-create-identity-tables.js';

/**
 * Migrations are listed explicitly instead of globbed, so the same list works from `src`
 * (tsx) and from `dist` (compiled). Applied names are recorded in `schema_migrations`.
 */
export function createMigrator(sequelize: Sequelize) {
  return new Umzug({
    migrations: [{ name: '0001-create-identity-tables', ...createIdentityTables }],
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize, tableName: 'schema_migrations' }),
    logger: undefined,
  });
}
