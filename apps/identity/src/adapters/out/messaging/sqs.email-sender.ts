import { SendMessageCommand, type SQSClient } from '@aws-sdk/client-sqs';
import { createCloudEvent, IDENTITY_SOURCE, SendEmailV1 } from '@ecommerce/event-contracts';
import { requestContext } from '@ecommerce/logger';
import type { Clock } from '../../../application/ports/clock.port.js';
import type { EmailMessage, EmailSender } from '../../../application/ports/email-sender.port.js';
import type { IdGenerator } from '../../../application/ports/id-generator.port.js';

/**
 * Sends the `send-email` command to the notification queue, consumed only by the notification
 * Lambda. One-time secrets travel here, never in broadcast events (ADR 0007).
 */
export class SqsEmailSender implements EmailSender {
  constructor(
    private readonly sqs: SQSClient,
    private readonly queueUrl: string,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const correlationId = requestContext.correlationId();
    // Validated on the way out: a contract mismatch fails here, not in the consumer's DLQ.
    const command = SendEmailV1.parse(
      createCloudEvent({
        id: this.idGenerator.generate(),
        source: IDENTITY_SOURCE,
        type: 'com.ecommerce.notification.email.send.v1',
        time: this.clock.now(),
        data: message,
        ...(correlationId !== undefined && { correlationId }),
      }),
    );
    await this.sqs.send(
      new SendMessageCommand({ QueueUrl: this.queueUrl, MessageBody: JSON.stringify(command) }),
    );
  }
}
