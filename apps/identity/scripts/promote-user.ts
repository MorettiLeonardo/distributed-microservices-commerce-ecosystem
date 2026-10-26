/**
 * Grants the admin role to a verified user: `pnpm --filter @ecommerce/identity users:promote <email>`.
 * Operator-only on purpose (ADR 0012); writes an audit log line. The new role reaches the access
 * token on the user's next login or refresh.
 */
import { userInfo } from 'node:os';
import { DomainError } from '@ecommerce/ddd';
import { createDatabase } from '../src/adapters/out/persistence/database.js';
import { SequelizeUserRepository } from '../src/adapters/out/persistence/repositories/user.repository.js';
import { PromoteUserToAdmin } from '../src/application/use-cases/promote-user-to-admin.use-case.js';
import { createLogger } from '../src/logger.js';

const url = process.env['DATABASE_URL'];
if (!url) throw new Error('DATABASE_URL is not set');

const email = process.argv[2];
if (!email) {
  process.stderr.write('usage: users:promote <email>\n');
  process.exit(1);
}

const logger = createLogger({ level: 'info' });
const sequelize = createDatabase(url);

try {
  const result = await new PromoteUserToAdmin({ users: new SequelizeUserRepository() }).execute({
    email,
  });
  logger.info(
    {
      audit: true,
      action: 'user.promote_to_admin',
      operator: userInfo().username,
      userId: result.userId,
      alreadyAdmin: result.alreadyAdmin,
    },
    result.alreadyAdmin ? 'user was already an admin' : 'user promoted to admin',
  );
} catch (error) {
  if (!(error instanceof DomainError)) throw error;
  // Business refusals (unknown or unverified user) are expected outcomes, not crashes.
  process.stderr.write(`not promoted: ${error.message} (${error.code})\n`);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
