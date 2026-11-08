import { FakeClock, FakeImageUploadSigner, SequentialIdGenerator } from './fakes.js';
import { InMemoryDatabase } from './in-memory-database.js';

/**
 * Every port a use case may need, backed by fakes. Pass it whole to any use case constructor.
 * The clock starts at a fixed date unless `now` is given.
 */
export function createTestContext(now = new Date('2026-10-28T12:00:00.000Z')) {
  const db = new InMemoryDatabase();

  return {
    db,
    clock: new FakeClock(now),
    ...db.repositories,
    idGenerator: new SequentialIdGenerator(),
    signer: new FakeImageUploadSigner(),
  };
}

export type TestContext = ReturnType<typeof createTestContext>;
