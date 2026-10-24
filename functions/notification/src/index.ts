import { createTransport } from 'nodemailer';
import { createHandler, type Log } from './handler.js';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

// Module scope runs once per cold start; warm invocations reuse the SMTP transport.
const transport = createTransport({
  host: requireEnv('SMTP_HOST'),
  port: Number(requireEnv('SMTP_PORT')),
  secure: false,
});

/** One JSON object per line, which CloudWatch Logs (and Floci) keep as-is. */
const log: Log = (level, message, fields) => {
  process.stdout.write(
    `${JSON.stringify({ level, message, service: 'notification', ...fields })}\n`,
  );
};

export const handler = createHandler({
  from: requireEnv('EMAIL_FROM'),
  log,
  mailer: {
    send: async (mail) => {
      await transport.sendMail(mail);
    },
  },
});
