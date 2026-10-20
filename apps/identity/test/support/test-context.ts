import { RegisterUser } from '../../src/application/use-cases/register-user.use-case.js';
import {
  FakeAccessTokenIssuer,
  FakeClock,
  FakePasswordHasher,
  FakeSecureTokenGenerator,
  InMemoryLoginAttemptLimiter,
  RecordingEmailSender,
  RecordingEventPublisher,
  SequentialIdGenerator,
} from './fakes.js';
import { InMemoryDatabase } from './in-memory-database.js';

export const DAY_MS = 24 * 60 * 60 * 1000;
export const SESSION_TTL_MS = 30 * DAY_MS;

/** Every port a use case may need, backed by fakes. Pass it whole to any use case constructor. */
export function createTestContext() {
  const clock = new FakeClock(new Date('2026-10-19T12:00:00.000Z'));
  const db = new InMemoryDatabase();

  return {
    db,
    clock,
    ...db.repositories,
    unitOfWork: db.unitOfWork,
    idGenerator: new SequentialIdGenerator(),
    passwordHasher: new FakePasswordHasher(),
    tokenGenerator: new FakeSecureTokenGenerator(),
    accessTokenIssuer: new FakeAccessTokenIssuer(clock),
    eventPublisher: new RecordingEventPublisher(),
    emailSender: new RecordingEmailSender(),
    loginAttemptLimiter: new InMemoryLoginAttemptLimiter(clock),
    sessionTtlMs: SESSION_TTL_MS,
  };
}

export type TestContext = ReturnType<typeof createTestContext>;

/** Registers a user and returns the token from the verification email. */
export async function registerUser(
  ctx: TestContext,
  credentials = { email: 'john@example.com', password: 'correct horse' },
): Promise<string> {
  await new RegisterUser(ctx).execute(credentials);
  const message = ctx.emailSender.sent.at(-1);
  if (message?.template !== 'email-verification') throw new Error('No verification email sent');
  return message.token;
}
