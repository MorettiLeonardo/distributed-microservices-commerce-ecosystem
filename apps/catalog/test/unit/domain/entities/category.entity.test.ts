import { describe, expect, it } from 'vitest';
import { Category } from '../../../../src/domain/entities/category.entity.js';
import { InvalidCategoryNameError } from '../../../../src/domain/errors/category.error.js';
import { CategoryId } from '../../../../src/domain/value-objects/identifiers.js';

const now = new Date('2026-10-25T12:00:00.000Z');

describe('Category', () => {
  it('trims the name and records CategoryCreated', () => {
    const category = Category.create({ id: CategoryId('cat-1'), name: '  Books  ', now });

    expect(category.name).toBe('Books');
    expect(category.createdAt).toEqual(now);
    expect(category.pullEvents()).toEqual([
      { type: 'CategoryCreated', categoryId: 'cat-1', name: 'Books', occurredAt: now },
    ]);
  });

  it.each(['', '   ', 'x'.repeat(61)])('rejects the name %j', (name) => {
    expect(() => Category.create({ id: CategoryId('cat-1'), name, now })).toThrow(
      InvalidCategoryNameError,
    );
  });

  it('records no events when restored', () => {
    const category = Category.restore({ id: CategoryId('cat-1'), name: 'Books', createdAt: now });
    expect(category.pullEvents()).toEqual([]);
  });
});
