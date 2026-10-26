import { InvalidMoneyError } from '../errors/money.error.js';

/** Single currency for now (K3). Changing it is a business decision, not a config switch. */
export const Currency = ['BRL'] as const;
export type Currency = (typeof Currency)[number];

/**
 * An amount of money in integer cents: never floats, so 0.1 + 0.2 never shows up in a price.
 * Catalog only stores prices; arithmetic (totals, discounts) belongs to the contexts that need it.
 */
export class Money {
  private constructor(
    readonly amount: number,
    readonly currency: Currency,
  ) {}

  static of(amount: number, currency: string = 'BRL'): Money {
    const known = Currency.find((code) => code === currency);
    if (!Number.isSafeInteger(amount) || amount < 0 || !known) throw new InvalidMoneyError();
    return new Money(amount, known);
  }

  get isZero(): boolean {
    return this.amount === 0;
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }

  toJSON(): { amount: number; currency: Currency } {
    return { amount: this.amount, currency: this.currency };
  }
}
