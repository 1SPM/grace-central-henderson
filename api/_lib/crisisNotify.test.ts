import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockSupabase } from '../../tests/fixtures/mockSupabase.js';

vi.mock('./email/resend.js', () => ({ sendViaResend: vi.fn() }));
vi.mock('./sms/send.js', () => ({ sendSms: vi.fn() }));

const CHURCH_ID = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe('notifyCrisisStaff', () => {
  it('sends an email to every enabled email-channel recipient with a phone/email on file', async () => {
    const { notifyCrisisStaff } = await import('./crisisNotify.js');
    const { sendViaResend } = await import('./email/resend.js');
    (sendViaResend as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, provider: 'resend', message_id: 'em_1' });

    const supabase = createMockSupabase({
      tables: {
        staff_notification_prefs: () => ({
          data: [
            { user_id: 'u1', channel: 'email', users: { email: 'pastor@example.invalid', phone: null } },
          ],
        }),
      },
    });

    const result = await notifyCrisisStaff(supabase as never, CHURCH_ID, 'https://example.invalid');

    expect(sendViaResend).toHaveBeenCalledTimes(1);
    expect(sendViaResend).toHaveBeenCalledWith(expect.objectContaining({ to: 'pastor@example.invalid' }));
    expect(result.emailsSent).toBe(1);
  });

  it('never includes member details in the email body — only a title and deep link', async () => {
    const { notifyCrisisStaff } = await import('./crisisNotify.js');
    const { sendViaResend } = await import('./email/resend.js');
    (sendViaResend as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, provider: 'resend', message_id: 'em_1' });

    const supabase = createMockSupabase({
      tables: {
        staff_notification_prefs: () => ({
          data: [{ user_id: 'u1', channel: 'email', users: { email: 'pastor@example.invalid', phone: null } }],
        }),
      },
    });

    await notifyCrisisStaff(supabase as never, CHURCH_ID, 'https://example.invalid');

    const call = (sendViaResend as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.html).not.toMatch(/summary|message|category/i);
    expect(call.html).toContain('pastoral-care');
  });

  it('sends SMS only when the phone channel is enabled and a phone is on file', async () => {
    const { notifyCrisisStaff } = await import('./crisisNotify.js');
    const { sendSms } = await import('./sms/send.js');
    (sendSms as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, message_id: 'SM_1' });

    const supabase = createMockSupabase({
      tables: {
        staff_notification_prefs: () => ({
          data: [{ user_id: 'u1', channel: 'sms', users: { email: null, phone: '+15551234567' } }],
        }),
      },
    });

    const result = await notifyCrisisStaff(supabase as never, CHURCH_ID, 'https://example.invalid');

    expect(sendSms).toHaveBeenCalledTimes(1);
    expect(result.smsSent).toBe(1);
  });

  it('skips a channel with no matching contact info on file rather than erroring', async () => {
    const { notifyCrisisStaff } = await import('./crisisNotify.js');
    const { sendViaResend } = await import('./email/resend.js');
    const { sendSms } = await import('./sms/send.js');

    const supabase = createMockSupabase({
      tables: {
        staff_notification_prefs: () => ({
          data: [{ user_id: 'u1', channel: 'sms', users: { email: null, phone: null } }],
        }),
      },
    });

    const result = await notifyCrisisStaff(supabase as never, CHURCH_ID, 'https://example.invalid');

    expect(sendViaResend).not.toHaveBeenCalled();
    expect(sendSms).not.toHaveBeenCalled();
    expect(result.smsSent).toBe(0);
  });

  it('a thrown send error propagates to the caller (care.ts is responsible for the outer try/catch)', async () => {
    const { notifyCrisisStaff } = await import('./crisisNotify.js');
    const { sendViaResend } = await import('./email/resend.js');
    (sendViaResend as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('resend down'));

    const supabase = createMockSupabase({
      tables: {
        staff_notification_prefs: () => ({
          data: [{ user_id: 'u1', channel: 'email', users: { email: 'pastor@example.invalid', phone: null } }],
        }),
      },
    });

    await expect(notifyCrisisStaff(supabase as never, CHURCH_ID, 'https://example.invalid')).rejects.toThrow('resend down');
  });
});
