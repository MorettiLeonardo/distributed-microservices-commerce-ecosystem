import { CreateTopicCommand, SubscribeCommand } from '@aws-sdk/client-sns';
import {
  CreateQueueCommand,
  GetQueueAttributesCommand,
  ReceiveMessageCommand,
} from '@aws-sdk/client-sqs';
import { IdentityEvent, SendEmailV1 } from '@ecommerce/event-contracts';
import { requestContext } from '@ecommerce/logger';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SnsEventPublisher } from '../../../../../src/adapters/out/messaging/sns.event-publisher.js';
import { SqsEmailSender } from '../../../../../src/adapters/out/messaging/sqs.email-sender.js';
import { UserId } from '../../../../../src/domain/value-objects/identifiers.js';
import { FakeClock, SequentialIdGenerator } from '../../../../support/fakes.js';
import { startFloci, type TestFloci } from '../../../../support/floci.js';

describe('messaging adapters (Floci)', () => {
  let floci: TestFloci;

  beforeAll(async () => {
    floci = await startFloci();
  }, 120_000);

  afterAll(async () => {
    await floci?.stop();
  });

  async function createQueue(name: string): Promise<{ url: string; arn: string }> {
    const { QueueUrl } = await floci.sqs.send(new CreateQueueCommand({ QueueName: name }));
    const { Attributes } = await floci.sqs.send(
      new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ['QueueArn'] }),
    );
    if (!QueueUrl || !Attributes?.QueueArn) throw new Error('Queue not created');
    return { url: QueueUrl, arn: Attributes.QueueArn };
  }

  async function receiveOne(queueUrl: string): Promise<unknown> {
    const { Messages } = await floci.sqs.send(
      new ReceiveMessageCommand({ QueueUrl: queueUrl, WaitTimeSeconds: 5, MaxNumberOfMessages: 1 }),
    );
    const body = Messages?.[0]?.Body;
    if (!body) throw new Error('No message received');
    return JSON.parse(body);
  }

  it('publishes domain events to SNS as contract-valid CloudEvents', async () => {
    const { TopicArn } = await floci.sns.send(new CreateTopicCommand({ Name: 'identity-events' }));
    const queue = await createQueue('identity-events-subscriber');
    // Raw delivery: the subscriber gets our CloudEvent as-is, without the SNS wrapper.
    await floci.sns.send(
      new SubscribeCommand({
        TopicArn,
        Protocol: 'sqs',
        Endpoint: queue.arn,
        Attributes: { RawMessageDelivery: 'true' },
      }),
    );
    const publisher = new SnsEventPublisher(floci.sns, TopicArn ?? '', new SequentialIdGenerator());

    await requestContext.run({ correlationId: 'trace-42' }, () =>
      publisher.publish([
        {
          type: 'UserRegistered',
          userId: UserId('user-1'),
          email: 'john@example.com',
          occurredAt: new Date('2026-10-19T12:00:00.000Z'),
        },
      ]),
    );

    const message = IdentityEvent.parse(await receiveOne(queue.url));
    expect(message).toMatchObject({
      type: 'com.ecommerce.identity.user.registered.v1',
      source: '/ecommerce/identity',
      subject: 'user-1',
      time: '2026-10-19T12:00:00.000Z',
      correlationid: 'trace-42',
      data: { userId: 'user-1', email: 'john@example.com' },
    });
  });

  it('sends the send-email command to SQS as a contract-valid CloudEvent', async () => {
    const queue = await createQueue('send-email');
    const sender = new SqsEmailSender(
      floci.sqs,
      queue.url,
      new SequentialIdGenerator(),
      new FakeClock(new Date('2026-10-19T12:00:00.000Z')),
    );

    await sender.send({ template: 'email-verification', to: 'john@example.com', token: 'abc' });

    const command = SendEmailV1.parse(await receiveOne(queue.url));
    expect(command).toMatchObject({
      type: 'com.ecommerce.notification.email.send.v1',
      data: { template: 'email-verification', to: 'john@example.com', token: 'abc' },
    });
    // Outside a request there is no correlation id, and the attribute is omitted, not empty.
    expect(command).not.toHaveProperty('correlationid');
  });
});
