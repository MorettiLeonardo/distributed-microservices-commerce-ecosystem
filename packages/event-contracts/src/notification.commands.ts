import { z } from 'zod';
import { cloudEventSchema } from './cloud-event.js';

/*
 * Commands are intents sent point-to-point to one consumer's queue (imperative type).
 * `send-email` may carry one-time secrets, which is why it is a command on a dedicated
 * queue and never a broadcast event (ADR 0007).
 *
 * Email addresses are plain strings: the producer's domain already validated them, and a
 * second, slightly different validator here could reject what the producer accepted.
 */
export const SendEmailData = z.discriminatedUnion('template', [
  z.object({ template: z.literal('email-verification'), to: z.string(), token: z.string() }),
  z.object({ template: z.literal('password-reset'), to: z.string(), token: z.string() }),
  z.object({ template: z.literal('account-already-exists'), to: z.string() }),
]);
export type SendEmailData = z.infer<typeof SendEmailData>;

export const SendEmailV1 = cloudEventSchema(
  'com.ecommerce.notification.email.send.v1',
  SendEmailData,
);
export type SendEmailV1 = z.infer<typeof SendEmailV1>;
