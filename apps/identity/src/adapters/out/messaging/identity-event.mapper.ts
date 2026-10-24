import {
  createCloudEvent,
  IDENTITY_SOURCE,
  type IdentityEvent as IdentityEventMessage,
} from '@ecommerce/event-contracts';
import type { IdentityEvent } from '../../../domain/events/user.events.js';

type Metadata = { id: string; correlationId: string | undefined };

/** Domain event (internal shape) → versioned CloudEvent (public contract). */
export function toCloudEvent(event: IdentityEvent, metadata: Metadata): IdentityEventMessage {
  const envelope = {
    id: metadata.id,
    source: IDENTITY_SOURCE,
    time: event.occurredAt,
    subject: event.userId,
    ...(metadata.correlationId !== undefined && { correlationId: metadata.correlationId }),
  };

  switch (event.type) {
    case 'UserRegistered':
      return createCloudEvent({
        ...envelope,
        type: 'com.ecommerce.identity.user.registered.v1',
        data: { userId: event.userId, email: event.email },
      });
    case 'UserEmailVerified':
      return createCloudEvent({
        ...envelope,
        type: 'com.ecommerce.identity.user.email-verified.v1',
        data: { userId: event.userId },
      });
    case 'UserPasswordResetRequested':
      return createCloudEvent({
        ...envelope,
        type: 'com.ecommerce.identity.user.password-reset-requested.v1',
        data: { userId: event.userId },
      });
    case 'UserPasswordChanged':
      return createCloudEvent({
        ...envelope,
        type: 'com.ecommerce.identity.user.password-changed.v1',
        data: { userId: event.userId },
      });
    case 'UserLockedOut':
      return createCloudEvent({
        ...envelope,
        type: 'com.ecommerce.identity.user.locked-out.v1',
        data: { userId: event.userId, lockedUntil: event.lockedUntil.toISOString() },
      });
    default: {
      const unhandled: never = event;
      throw new Error(`No contract for domain event ${JSON.stringify(unhandled)}`);
    }
  }
}
