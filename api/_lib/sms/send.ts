/**
 * Twilio REST send — extracted from api/sms/_send.ts so a second
 * caller (the crisis notification path, api/portal/_care.ts) doesn't
 * have to duplicate the Twilio call a third time. api/sms/_send.ts now
 * delegates to sendSms() for the actual send; it keeps its own request
 * parsing/validation since that's HTTP-route concern, not send logic.
 *
 * Mirrors api/_lib/email/resend.ts's shape: never throws, returns a
 * discriminated-union result, reads env vars at call time (not module
 * load) so tests and cold starts both see current values.
 */

const TWILIO_BASE_URL = 'https://api.twilio.com/2010-04-01';

function twilioAccountSid(): string | undefined { return process.env.TWILIO_ACCOUNT_SID; }
function twilioAuthToken(): string | undefined { return process.env.TWILIO_AUTH_TOKEN; }
function twilioFromNumber(): string | undefined { return process.env.TWILIO_FROM_NUMBER; }

interface TwilioResponse {
  sid?: string;
  status?: string;
  message?: string;
}

export function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 15;
}

export function formatPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (!phone.startsWith('+')) return `+${digits}`;
  return phone;
}

export interface SendSmsInput {
  to: string;
  message: string;
}

export type SendSmsResult =
  | { ok: true; message_id: string; status?: string }
  | { ok: false; skipped: true; reason: 'not_configured' | 'invalid_phone' }
  | { ok: false; skipped: false; status: number; error: string };

export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  const accountSid = twilioAccountSid();
  const authToken = twilioAuthToken();
  const fromNumber = twilioFromNumber();
  if (!accountSid || !authToken || !fromNumber) {
    return { ok: false, skipped: true, reason: 'not_configured' };
  }
  if (!isValidPhone(input.to)) {
    return { ok: false, skipped: true, reason: 'invalid_phone' };
  }

  try {
    const formData = new URLSearchParams();
    formData.append('To', formatPhoneNumber(input.to));
    formData.append('From', fromNumber);
    formData.append('Body', String(input.message).slice(0, 1600));

    const res = await fetch(`${TWILIO_BASE_URL}/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });
    const body = await res.json() as TwilioResponse;
    if (!res.ok) {
      return { ok: false, skipped: false, status: res.status, error: body.message ?? `twilio HTTP ${res.status}` };
    }
    if (!body.sid) {
      return { ok: false, skipped: false, status: 200, error: 'twilio returned no sid' };
    }
    return { ok: true, message_id: body.sid, status: body.status };
  } catch (err) {
    return {
      ok: false,
      skipped: false,
      status: 0,
      error: err instanceof Error ? err.message : 'unknown network error',
    };
  }
}
