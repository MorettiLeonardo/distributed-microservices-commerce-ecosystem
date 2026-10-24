import { z } from 'zod';
import { cloudEventSchema } from './cloud-event.js';

export const IDENTITY_SOURCE = '/ecommerce/identity';

/*
 * Facts published by identity to its SNS topic. They never carry secrets (ADR 0007).
 * An incompatible change to `data` means a new `.v2` type, published alongside `.v1`.
 */

export const UserRegisteredV1 = cloudEventSchema(
  'com.ecommerce.identity.user.registered.v1',
  z.object({ userId: z.string(), email: z.string() }),
);

export const UserEmailVerifiedV1 = cloudEventSchema(
  'com.ecommerce.identity.user.email-verified.v1',
  z.object({ userId: z.string() }),
);

export const UserPasswordResetRequestedV1 = cloudEventSchema(
  'com.ecommerce.identity.user.password-reset-requested.v1',
  z.object({ userId: z.string() }),
);

export const UserPasswordChangedV1 = cloudEventSchema(
  'com.ecommerce.identity.user.password-changed.v1',
  z.object({ userId: z.string() }),
);

export const UserLockedOutV1 = cloudEventSchema(
  'com.ecommerce.identity.user.locked-out.v1',
  z.object({ userId: z.string(), lockedUntil: z.iso.datetime() }),
);

export const IdentityEvent = z.discriminatedUnion('type', [
  UserRegisteredV1,
  UserEmailVerifiedV1,
  UserPasswordResetRequestedV1,
  UserPasswordChangedV1,
  UserLockedOutV1,
]);
export type IdentityEvent = z.infer<typeof IdentityEvent>;
export type IdentityEventType = IdentityEvent['type'];
