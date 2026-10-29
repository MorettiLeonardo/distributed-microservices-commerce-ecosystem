/** Generates unique, time-ordered identifiers (UUIDv7, ADR 0006). */
export interface IdGenerator {
  generate(): string;
}
