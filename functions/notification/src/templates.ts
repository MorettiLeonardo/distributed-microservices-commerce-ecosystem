import type { SendEmailData } from '@ecommerce/event-contracts';

export type RenderedEmail = { subject: string; text: string };

/** Plain-text emails. There is no frontend, so they carry the token and the API call to make. */
export function render(email: SendEmailData): RenderedEmail {
  switch (email.template) {
    case 'email-verification':
      return {
        subject: 'Verify your email',
        text: [
          'Welcome! Use this token to verify your email (valid for 24 hours):',
          '',
          email.token,
          '',
          `POST /v1/auth/verify-email  {"token": "${email.token}"}`,
        ].join('\n'),
      };
    case 'password-reset':
      return {
        subject: 'Reset your password',
        text: [
          'Use this token to choose a new password (valid for 30 minutes):',
          '',
          email.token,
          '',
          `POST /v1/auth/reset-password  {"token": "${email.token}", "newPassword": "..."}`,
          '',
          'If you did not ask for this, ignore this email.',
        ].join('\n'),
      };
    case 'account-already-exists':
      return {
        subject: 'Someone tried to register with your email',
        text: [
          'Someone tried to create an account with this email, but you already have one.',
          'If it was you, log in or reset your password. Otherwise, ignore this email.',
        ].join('\n'),
      };
  }
}
