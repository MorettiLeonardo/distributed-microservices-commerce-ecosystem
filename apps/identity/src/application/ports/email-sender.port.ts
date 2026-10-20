export type EmailMessage =
  | { template: 'email-verification'; to: string; token: string }
  | { template: 'password-reset'; to: string; token: string }
  | { template: 'account-already-exists'; to: string };

/**
 * Requests an email. Delivery is asynchronous: the adapter enqueues a `send-email` command
 * consumed only by the notification Lambda, so one-time secrets never travel in domain events (ADR 0007).
 */
export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}
