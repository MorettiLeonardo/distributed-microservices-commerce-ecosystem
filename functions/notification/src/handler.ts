import { SendEmailV1 } from '@ecommerce/event-contracts';
import type { SQSBatchItemFailure, SQSBatchResponse, SQSEvent } from 'aws-lambda';
import { render } from './templates.js';

export type Mail = { from: string; to: string; subject: string; text: string };

/** Outbound port: whatever actually delivers the email (SMTP via nodemailer in production). */
export interface Mailer {
  send(mail: Mail): Promise<void>;
}

export type Log = (
  level: 'info' | 'error',
  message: string,
  fields: Record<string, unknown>,
) => void;

/**
 * Consumes `send-email` commands from SQS. Each record succeeds or fails on its own: failed
 * ones are reported back (partial batch response) so only they return to the queue, and after
 * the redrive limit they land in the DLQ. Tokens are never logged.
 */
export function createHandler(deps: { mailer: Mailer; from: string; log: Log }) {
  return async (event: SQSEvent): Promise<SQSBatchResponse> => {
    const batchItemFailures: SQSBatchItemFailure[] = [];

    for (const record of event.Records) {
      try {
        const command = SendEmailV1.parse(JSON.parse(record.body));
        await deps.mailer.send({ from: deps.from, to: command.data.to, ...render(command.data) });
        deps.log('info', 'email sent', {
          messageId: record.messageId,
          commandId: command.id,
          correlationId: command.correlationid,
          template: command.data.template,
        });
      } catch (error) {
        deps.log('error', 'email failed', {
          messageId: record.messageId,
          error: error instanceof Error ? error.message : String(error),
        });
        batchItemFailures.push({ itemIdentifier: record.messageId });
      }
    }

    return { batchItemFailures };
  };
}
