/**
 * Applies pending migrations (`up`, default) or reverts the last one (`down`).
 * Runs as its own step, never on service boot: replicas starting together would race.
 */
import { createDatabase } from '../src/adapters/out/persistence/database.js';
import { createMigrator } from '../src/adapters/out/persistence/migrator.js';

const url = process.env['DATABASE_URL'];
if (!url) throw new Error('DATABASE_URL is not set');

const sequelize = createDatabase(url);
const migrator = createMigrator(sequelize);

try {
  const applied = process.argv[2] === 'down' ? await migrator.down() : await migrator.up();
  const names = applied.map((migration) => migration.name);
  process.stdout.write(
    `${process.argv[2] === 'down' ? 'reverted' : 'applied'}: ${names.join(', ') || 'nothing'}\n`,
  );
} finally {
  await sequelize.close();
}
