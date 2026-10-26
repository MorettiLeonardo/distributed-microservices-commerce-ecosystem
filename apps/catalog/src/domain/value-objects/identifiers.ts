import type { Brand } from '@ecommerce/ddd';

export type CategoryId = Brand<string, 'CategoryId'>;
export const CategoryId = (value: string): CategoryId => value as CategoryId;

export type ProductId = Brand<string, 'ProductId'>;
export const ProductId = (value: string): ProductId => value as ProductId;

export type ProductImageId = Brand<string, 'ProductImageId'>;
export const ProductImageId = (value: string): ProductImageId => value as ProductImageId;
