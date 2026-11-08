import type { Clock } from '#src/application/ports/clock.port.js';

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
