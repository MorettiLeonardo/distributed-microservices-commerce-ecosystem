import { z } from 'zod';

/** Roles a token may carry. Mirrors identity's `UserRole`; changing it is a contract change. */
export const Role = z.enum(['customer', 'admin']);
export type Role = z.infer<typeof Role>;

/**
 * Wire format of the access token payload issued by identity (ADR 0007, 0012): the contract
 * between the issuer and every service that verifies tokens through the JWKS.
 */
export const AccessTokenPayload = z.object({
  sub: z.string().min(1),
  email: z.string(),
  emailVerified: z.boolean(),
  role: Role,
});

/** What services work with once a token is verified. */
export type AccessTokenClaims = {
  userId: string;
  email: string;
  emailVerified: boolean;
  role: Role;
};

export function toClaims(payload: unknown): AccessTokenClaims | null {
  const result = AccessTokenPayload.safeParse(payload);
  if (!result.success) return null;
  const { sub, email, emailVerified, role } = result.data;
  return { userId: sub, email, emailVerified, role };
}
