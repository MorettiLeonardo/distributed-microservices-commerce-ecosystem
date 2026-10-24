import { describe, expect, it } from 'vitest';
import { createCloudEvent, IdentityEvent, SendEmailV1 } from '../../src/index.js';

const base = {
  id: '0192a1f3-0000-7000-8000-000000000001',
  source: '/ecommerce/identity',
  time: new Date('2026-10-19T12:00:00.000Z'),
};

function command(data: unknown) {
  return createCloudEvent({ ...base, type: 'com.ecommerce.notification.email.send.v1', data });
}

describe('event contracts', () => {
  it('builds a CloudEvents 1.0 envelope that its schema accepts', () => {
    const event = createCloudEvent({
      ...base,
      type: 'com.ecommerce.identity.user.registered.v1',
      subject: 'user-1',
      correlationId: 'trace-1',
      data: { userId: 'user-1', email: 'john@example.com' },
    });

    expect(event).toMatchObject({
      specversion: '1.0',
      time: '2026-10-19T12:00:00.000Z',
      datacontenttype: 'application/json',
      correlationid: 'trace-1',
    });
    expect(IdentityEvent.parse(event)).toEqual(event);
  });

  it('omits optional attributes instead of sending them empty', () => {
    const event = createCloudEvent({
      ...base,
      type: 'com.ecommerce.identity.user.email-verified.v1',
      data: { userId: 'user-1' },
    });

    expect(event).not.toHaveProperty('subject');
    expect(event).not.toHaveProperty('correlationid');
  });

  it('rejects an event whose data does not match its type', () => {
    const event = createCloudEvent({
      ...base,
      type: 'com.ecommerce.identity.user.locked-out.v1',
      data: { userId: 'user-1' },
    });

    expect(IdentityEvent.safeParse(event).success).toBe(false);
  });

  it('requires a token for verification emails but not for account notices', () => {
    expect(
      SendEmailV1.safeParse(command({ template: 'email-verification', to: 'a@b.co' })).success,
    ).toBe(false);
    expect(
      SendEmailV1.safeParse(command({ template: 'account-already-exists', to: 'a@b.co' })).success,
    ).toBe(true);
  });
});
