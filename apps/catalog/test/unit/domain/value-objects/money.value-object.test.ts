import { describe, expect, it } from 'vitest';
import { InvalidMoneyError } from '../../../../src/domain/errors/money.error.js';
import { Money } from '../../../../src/domain/value-objects/money.value-object.js';

describe('Money', () => {
  it('holds an amount in cents and defaults to BRL', () => {
    const price = Money.of(1990);

    expect(price.amount).toBe(1990);
    expect(price.currency).toBe('BRL');
    expect(price.toJSON()).toEqual({ amount: 1990, currency: 'BRL' });
  });

  it.each([-1, 19.9, Number.NaN, Number.POSITIVE_INFINITY])('rejects %s cents', (amount) => {
    expect(() => Money.of(amount)).toThrow(InvalidMoneyError);
  });

  it('rejects a currency other than BRL', () => {
    expect(() => Money.of(100, 'USD')).toThrow(InvalidMoneyError);
  });

  it('compares by value', () => {
    expect(Money.of(100).equals(Money.of(100))).toBe(true);
    expect(Money.of(100).equals(Money.of(101))).toBe(false);
  });

  it('knows whether it is zero', () => {
    expect(Money.of(0).isZero).toBe(true);
    expect(Money.of(1).isZero).toBe(false);
  });
});
