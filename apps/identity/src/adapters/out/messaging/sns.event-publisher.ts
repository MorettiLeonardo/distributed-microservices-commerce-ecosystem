import { PublishCommand, type SNSClient } from '@aws-sdk/client-sns';
import { requestContext } from '@ecommerce/logger';
import type { EventPublisher } from '../../../application/ports/event-publisher.port.js';
import type { IdGenerator } from '../../../application/ports/id-generator.port.js';
import type { IdentityEvent } from '../../../domain/events/user.events.js';
import { toCloudEvent } from './identity-event.mapper.js';

/** Publishes domain events to identity's SNS topic (pub/sub: any service may subscribe). */
export class SnsEventPublisher implements EventPublisher {
  constructor(
    private readonly sns: SNSClient,
    private readonly topicArn: string,
    private readonly idGenerator: IdGenerator,
  ) {}

  async publish(events: readonly IdentityEvent[]): Promise<void> {
    for (const event of events) {
      const message = toCloudEvent(event, {
        id: this.idGenerator.generate(),
        correlationId: requestContext.correlationId(),
      });
      await this.sns.send(
        new PublishCommand({
          TopicArn: this.topicArn,
          Message: JSON.stringify(message),
          // Lets subscribers filter by type with an SNS filter policy, without parsing the body.
          MessageAttributes: { type: { DataType: 'String', StringValue: message.type } },
        }),
      );
    }
  }
}
