import { UniqueConstraintError } from 'sequelize';
import { CategoryNameTakenError } from '../../../../application/errors/category-name-taken.error.js';
import type { CategoryRepository } from '../../../../application/ports/category.repository.port.js';
import type { Category } from '../../../../domain/entities/category.entity.js';
import { CategoryModel } from '../models/category.model.js';

/** Created by migration 0001 on lower(name). */
const NAME_UNIQUE_INDEX = 'categories_name_unique';

export class SequelizeCategoryRepository implements CategoryRepository {
  async save(category: Category): Promise<void> {
    try {
      await CategoryModel.upsert({
        id: category.id,
        name: category.name,
        createdAt: category.createdAt,
      });
    } catch (error) {
      // Matched by index name, not by `error.fields`: on an expression index Postgres reports
      // the key as `lower(name)`, not as the `name` column.
      if (
        error instanceof UniqueConstraintError &&
        violatedConstraint(error) === NAME_UNIQUE_INDEX
      ) {
        throw new CategoryNameTakenError();
      }
      throw error;
    }
  }
}

/** The constraint name reported by the pg driver on the original error. */
function violatedConstraint(error: UniqueConstraintError): string | undefined {
  const original: unknown = error.original;
  if (typeof original === 'object' && original !== null && 'constraint' in original) {
    return typeof original.constraint === 'string' ? original.constraint : undefined;
  }
  return undefined;
}
