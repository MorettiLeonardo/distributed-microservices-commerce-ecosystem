import { createCloudEvent } from '@ecommerce/event-contracts';
import type { SQSEvent, SQSRecord } from 'aws-lambda';
import { beforeEach, describe, expect, it } from 'vitest';
import { createHandler, type Mail, type Mailer } from '../../src/handler.js';

class RecordingMailer implements Mailer {
  readonly sent: Mail[] = [];
  failFor: string | null = null;

  async send(mail: Mail): Promise<void> {
    if (mail.to === this.failFor) throw new Error('SMTP unavailable');
    this.sent.push(mail);
  }
}

function sendEmailBody(data: unknown): string {
  return JSON.stringify(
    createCloudEvent({
      id: 'command-1',
      source: '/ecommerce/identity',
      type: 'com.ecommerce.notification.email.send.v1',
      time: new Date('2026-10-19T12:00:00.000Z'),
      correlationId: 'trace-1',
      data,
    }),
  );
}

function sqsEvent(...bodies: string[]): SQSEvent {
  return {
    Records: bodies.map((body, index) => ({ messageId: `msg-${index + 1}`, body }) as SQSRecord),
  };
}

describe('notification handler', () => {
  let mailer: RecordingMailer;
  let logs: { level: string; message: string; fields: Record<string, unknown> }[];
  let handler: ReturnType<typeof createHandler>;

  beforeEach(() => {
    mailer = new RecordingMailer();
    logs = [];
    handler = createHandler({
      mailer,
      from: 'no-reply@ecommerce.dev',
      log: (level, message, fields) => logs.push({ level, message, fields }),
    });
  });

  it('sends the verification email with the token', async () => {
    const result = await handler(
      sqsEvent(
        sendEmailBody({ template: 'email-verification', to: 'john@example.com', token: 'abc' }),
      ),
    );

    expect(result.batchItemFailures).toEqual([]);
    expect(mailer.sent).toEqual([
      expect.objectContaining({
        from: 'no-reply@ecommerce.dev',
        to: 'john@example.com',
        subject: 'Verify your email',
        text: expect.stringContaining('abc'),
      }),
    ]);
  });

  it('reports only the failed records, so the rest are not retried', async () => {
    mailer.failFor = 'broken@example.com';

    const result = await handler(
      sqsEvent(
        sendEmailBody({ template: 'account-already-exists', to: 'john@example.com' }),
        sendEmailBody({ template: 'account-already-exists', to: 'broken@example.com' }),
        'not json',
      ),
    );

    expect(result.batchItemFailures).toEqual([
      { itemIdentifier: 'msg-2' },
      { itemIdentifier: 'msg-3' },
    ]);
    expect(mailer.sent.map((mail) => mail.to)).toEqual(['john@example.com']);
  });

  it('rejects a command that breaks the contract', async () => {
    const result = await handler(
      sqsEvent(sendEmailBody({ template: 'password-reset', to: 'a@b.co' })),
    );

    expect(result.batchItemFailures).toEqual([{ itemIdentifier: 'msg-1' }]);
  });

  it('logs the correlation id but never the token', async () => {
    await handler(
      sqsEvent(
        sendEmailBody({ template: 'password-reset', to: 'john@example.com', token: 'top-secret' }),
      ),
    );

    expect(logs[0]?.fields).toMatchObject({ correlationId: 'trace-1', template: 'password-reset' });
    expect(JSON.stringify(logs)).not.toContain('top-secret');
  });
});
