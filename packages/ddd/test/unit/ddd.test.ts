import { describe, expect, it } from 'vitest';
import { AggregateRoot, DomainError } from '../../src/index.js';

type CounterEvent = { type: 'incremented'; value: number };

class Counter extends AggregateRoot<CounterEvent> {
  value = 0;

  increment(): void {
    this.value += 1;
    this.record({ type: 'incremented', value: this.value });
  }
}

class CounterOverflowError extends DomainError {
  readonly code = 'COUNTER_OVERFLOW';
}

describe('AggregateRoot', () => {
  it('returns recorded events in order and clears them once pulled', () => {
    const counter = new Counter();
    counter.increment();
    counter.increment();

    expect(counter.pullEvents()).toEqual([
      { type: 'incremented', value: 1 },
      { type: 'incremented', value: 2 },
    ]);
    expect(counter.pullEvents()).toEqual([]);
  });
});

describe('DomainError', () => {
  it('exposes a stable code and the subclass name', () => {
    const error = new CounterOverflowError('Counter is full');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('COUNTER_OVERFLOW');
    expect(error.name).toBe('CounterOverflowError');
    expect(error.message).toBe('Counter is full');
  });
});
