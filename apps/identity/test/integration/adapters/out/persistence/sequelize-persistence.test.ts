import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createMigrator } from '../../../../../src/adapters/out/persistence/migrator.js';
import {
  createRepositories,
  SequelizeUnitOfWork,
} from '../../../../../src/adapters/out/persistence/sequelize.unit-of-work.js';
import { EmailAlreadyRegisteredError } from '../../../../../src/application/errors/email-already-registered.error.js';
import { OneTimeToken } from '../../../../../src/domain/entities/one-time-token.entity.js';
import { Session } from '../../../../../src/domain/entities/session.entity.js';
import { User } from '../../../../../src/domain/entities/user.entity.js';
import { Email } from '../../../../../src/domain/value-objects/email.value-object.js';
import {
  OneTimeTokenId,
  PasswordHash,
  SessionId,
  TokenHash,
  UserId,
} from '../../../../../src/domain/value-objects/identifiers.js';
import { startPostgres, type TestPostgres } from '../../../../support/postgres.js';

const NOW = new Date('2026-10-19T12:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

function newUser(id: string, email = 'john@example.com'): User {
  return User.register({
    id: UserId(id),
    email: Email.create(email),
    passwordHash: PasswordHash('bcrypt-hash'),
    now: NOW,
  });
}

describe('Sequelize persistence (Postgres)', () => {
  let pg: TestPostgres;
  const repos = createRepositories();

  beforeAll(async () => {
    pg = await startPostgres();
  }, 120_000);

  afterAll(async () => {
    await pg?.stop();
  });

  beforeEach(async () => {
    await pg.truncate();
  });

  describe('users', () => {
    it('round-trips a user through the mapper', async () => {
      const user = newUser('0192a1f0-0000-7000-8000-000000000001');
      await repos.users.save(user);

      const loaded = await repos.users.findByEmail(Email.create('JOHN@example.com'));

      expect(loaded?.id).toBe(user.id);
      expect(loaded?.email.value).toBe('john@example.com');
      expect(loaded?.status).toBe('pending_verification');
      expect(loaded?.createdAt).toEqual(NOW);
    });

    it('updates the same row when saved again (upsert)', async () => {
      const user = newUser('0192a1f0-0000-7000-8000-000000000001');
      await repos.users.save(user);
      user.verifyEmail(NOW);
      await repos.users.save(user);

      const loaded = await repos.users.findById(user.id);

      expect(loaded?.status).toBe('active');
      expect(loaded?.emailVerifiedAt).toEqual(NOW);
    });

    it('persists the role, defaulting new users to customer', async () => {
      const customer = newUser('0192a1f0-0000-7000-8000-000000000001');
      const admin = newUser('0192a1f0-0000-7000-8000-000000000002', 'ann@example.com');
      admin.verifyEmail(NOW);
      admin.promoteToAdmin();
      await repos.users.save(customer);
      await repos.users.save(admin);

      expect((await repos.users.findById(customer.id))?.role).toBe('customer');
      expect((await repos.users.findById(admin.id))?.role).toBe('admin');
    });

    it('rejects an unknown role at the database level (CHECK constraint)', async () => {
      const user = newUser('0192a1f0-0000-7000-8000-000000000001');
      await repos.users.save(user);

      await expect(
        pg.sequelize.query(`UPDATE users SET role = 'superuser' WHERE id = :id`, {
          replacements: { id: user.id },
        }),
      ).rejects.toThrow(/users_role_check/);
    });

    it('translates the UNIQUE email violation into EmailAlreadyRegisteredError', async () => {
      await repos.users.save(newUser('0192a1f0-0000-7000-8000-000000000001'));

      await expect(
        repos.users.save(newUser('0192a1f0-0000-7000-8000-000000000002')),
      ).rejects.toThrow(EmailAlreadyRegisteredError);
    });

    it('lets only one of two concurrent transactions insert the same email', async () => {
      const unitOfWork = new SequelizeUnitOfWork(pg.sequelize);
      const register = (id: string) => unitOfWork.run(({ users }) => users.save(newUser(id)));

      const results = await Promise.allSettled([
        register('0192a1f0-0000-7000-8000-000000000001'),
        register('0192a1f0-0000-7000-8000-000000000002'),
      ]);

      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(results.find((result) => result.status === 'rejected')).toMatchObject({
        reason: expect.any(EmailAlreadyRegisteredError),
      });
    });
  });

  describe('sessions', () => {
    it('finds only the active sessions of a user', async () => {
      const user = newUser('0192a1f0-0000-7000-8000-000000000001');
      await repos.users.save(user);
      const start = (id: string) =>
        Session.start({
          id: SessionId(id),
          userId: user.id,
          tokenHash: TokenHash(`hash-${id}`),
          now: NOW,
          ttlMs: 30 * DAY_MS,
        });
      const active = start('0192a1f0-0000-7000-8000-00000000000a');
      const revoked = start('0192a1f0-0000-7000-8000-00000000000b');
      revoked.revoke(NOW);
      await repos.sessions.save(active);
      await repos.sessions.save(revoked);

      const found = await repos.sessions.findActiveByUserId(user.id);

      expect(found.map((session) => session.id)).toEqual([active.id]);
      expect(found[0]?.expiresAt).toEqual(new Date(NOW.getTime() + 30 * DAY_MS));
    });
  });

  describe('one-time tokens', () => {
    it('finds a token by hash and purpose only', async () => {
      const user = newUser('0192a1f0-0000-7000-8000-000000000001');
      await repos.users.save(user);
      await repos.oneTimeTokens.save(
        OneTimeToken.issue({
          id: OneTimeTokenId('0192a1f0-0000-7000-8000-0000000000aa'),
          userId: user.id,
          purpose: 'email_verification',
          tokenHash: TokenHash('token-hash'),
          now: NOW,
        }),
      );

      const found = await repos.oneTimeTokens.findByHash(
        TokenHash('token-hash'),
        'email_verification',
      );
      const wrongPurpose = await repos.oneTimeTokens.findByHash(
        TokenHash('token-hash'),
        'password_reset',
      );

      expect(found?.userId).toBe(user.id);
      expect(found?.consumedAt).toBeNull();
      expect(wrongPurpose).toBeNull();
    });
  });

  describe('unit of work', () => {
    it('commits every write together', async () => {
      const unitOfWork = new SequelizeUnitOfWork(pg.sequelize);
      const user = newUser('0192a1f0-0000-7000-8000-000000000001');

      await unitOfWork.run(async ({ users }) => {
        await users.save(user);
      });

      expect(await repos.users.findById(user.id)).not.toBeNull();
    });

    it('rolls back every write when the work throws', async () => {
      const unitOfWork = new SequelizeUnitOfWork(pg.sequelize);
      const user = newUser('0192a1f0-0000-7000-8000-000000000001');

      await expect(
        unitOfWork.run(async ({ users }) => {
          await users.save(user);
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');

      expect(await repos.users.findById(user.id)).toBeNull();
    });
  });

  describe('migrations', () => {
    it('reverts and reapplies the role column', async () => {
      const migrator = createMigrator(pg.sequelize);
      const columns = async () =>
        Object.keys(await pg.sequelize.getQueryInterface().describeTable('users'));

      await migrator.down();
      expect(await columns()).not.toContain('role');

      await migrator.up();
      expect(await columns()).toContain('role');
    });
  });
});
