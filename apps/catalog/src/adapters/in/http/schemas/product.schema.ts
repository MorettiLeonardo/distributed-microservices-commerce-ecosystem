import { z } from 'zod';

/*
 * Shape only: types, UUIDs (the columns are typed) and generous upper bounds against abuse.
 * Business rules (lengths, price above zero, whole cents, known currency, weight range) stay in
 * the domain, so they answer with the domain's error codes.
 */
export const CreateProductBody = z.object({
  categoryId: z.uuid(),
  name: z.string().max(1000),
  description: z.string().max(20_000).optional(),
  price: z.object({ amount: z.number(), currency: z.string().max(10).optional() }).optional(),
  weightGrams: z.number().optional(),
});

/** No field is nullable: the domain cannot clear a weight or a category once set. */
export const UpdateProductDetailsBody = z.object({
  name: z.string().max(1000).optional(),
  description: z.string().max(20_000).optional(),
  categoryId: z.uuid().optional(),
  weightGrams: z.number().optional(),
});

export const ProductIdParams = z.object({ id: z.uuid() });
