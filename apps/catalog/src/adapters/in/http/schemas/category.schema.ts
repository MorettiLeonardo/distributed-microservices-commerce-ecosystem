import { z } from 'zod';

/*
 * Shape only: types and generous upper bounds against abuse. Business rules (name length) stay
 * in the domain, so they answer with the domain's error codes.
 */
export const CreateCategoryBody = z.object({ name: z.string().max(1000) });
