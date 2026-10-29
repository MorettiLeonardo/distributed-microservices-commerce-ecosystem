import type { Clock } from '../../src/application/ports/clock.port.js';
import type { IdGenerator } from '../../src/application/ports/id-generator.port.js';

export class FakeClock implements Clock {
  constructor(private current: Date) {}

  now(): Date {
    return new Date(this.current);
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

export class SequentialIdGenerator implements IdGenerator {
  #next = 0;

  generate(): string {
    this.#next += 1;
    return `id-${this.#next}`;
  }
}
