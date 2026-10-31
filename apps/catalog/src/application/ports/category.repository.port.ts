import type { Category } from '../../domain/entities/category.entity.js';
import type { CategoryId } from '../../domain/value-objects/identifiers.js';

export interface CategoryRepository {
  /**
   * Throws `CategoryNameTakenError` when another category has the same name, in any case.
   * This is the only place the uniqueness rule is enforced (backed by a UNIQUE index).
   */
  save(category: Category): Promise<void>;

  /** `id` must be a UUID: the column is typed, so inbound adapters validate the shape first. */
  exists(id: CategoryId): Promise<boolean>;
}
