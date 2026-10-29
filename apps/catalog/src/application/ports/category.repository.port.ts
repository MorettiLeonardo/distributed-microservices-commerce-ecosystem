import type { Category } from '../../domain/entities/category.entity.js';

export interface CategoryRepository {
  /**
   * Throws `CategoryNameTakenError` when another category has the same name, in any case.
   * This is the only place the uniqueness rule is enforced (backed by a UNIQUE index).
   */
  save(category: Category): Promise<void>;
}
