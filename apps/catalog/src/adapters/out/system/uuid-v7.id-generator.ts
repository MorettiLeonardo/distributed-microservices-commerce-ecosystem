import { v7 as uuidv7 } from 'uuid';
import type { IdGenerator } from '../../../application/ports/id-generator.port.js';

/** Time-ordered ids keep B-tree primary key inserts at the end of the index (ADR 0006). */
export class UuidV7IdGenerator implements IdGenerator {
  generate(): string {
    return uuidv7();
  }
}
