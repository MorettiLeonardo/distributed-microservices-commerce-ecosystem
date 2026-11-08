import type { Sequelize } from 'sequelize';
import { SequelizeStorage, Umzug } from 'umzug';
import * as createCatalogTables from './migrations/0001-create-catalog-tables.js';
import * as createProductTables from './migrations/0002-create-product-tables.js';
import * as addProductVersion from './migrations/0003-add-product-version.js';
import * as createImageUploads from './migrations/0004-create-image-uploads.js';

/**
 * Migrations are listed explicitly instead of globbed, so the same list works from `src`
 * (tsx) and from `dist` (compiled). Applied names are recorded in `schema_migrations`.
 */
export function createMigrator(sequelize: Sequelize) {
  return new Umzug({
    migrations: [
      { name: '0001-create-catalog-tables', ...createCatalogTables },
      { name: '0002-create-product-tables', ...createProductTables },
      { name: '0003-add-product-version', ...addProductVersion },
      { name: '0004-create-image-uploads', ...createImageUploads },
    ],
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize, tableName: 'schema_migrations' }),
    logger: undefined,
  });
}
