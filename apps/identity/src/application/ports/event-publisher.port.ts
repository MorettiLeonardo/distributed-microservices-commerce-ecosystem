import type { IdentityEvent } from '../../domain/events/user.events.js';

/** Broadcasts domain events to any interested subscriber (pub/sub). Events carry no secrets. */
export interface EventPublisher {
  publish(events: readonly IdentityEvent[]): Promise<void>;
}
