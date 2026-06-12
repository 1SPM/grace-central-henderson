/**
 * Mock i2c adapter — deterministic, no network.
 *
 * Used when I2C_LIVE flag is off OR when I2C_API_KEY is unset (e.g.
 * local dev, CI, demo environments without sandbox creds).
 *
 * Deterministic-by-input so tests can assert exact shapes:
 *   - i2cKycId   = hash of (fullName + dateOfBirth + churchId)
 *   - i2cCardId  = hash of (kycVerificationId + cardholderName + now-rounded-minute)
 *   - maskedPan  = '••••' + last 4 of a hash of i2cCardId
 *
 * Approval logic mirrors a forgiving sandbox: most submissions are
 * approved instantly. Names containing "DECLINE" force a rejection
 * for test scenarios.
 */

import type {
  I2cAdapter,
  IssueCardInput,
  IssueCardResult,
  KycResult,
  SubmitKycInput,
  CardActionInput,
  CardActionResult,
} from './types.js';

function hash(input: string): string {
  // Cheap deterministic hash — sufficient for mock ids; NOT a security primitive.
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h) ^ input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}

function future(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

function shouldDecline(name: string): boolean {
  return /\bDECLINE\b|\bFAIL\b/i.test(name);
}

export const mockI2cAdapter: I2cAdapter = {
  mode: 'mock',

  async submitKyc(input: SubmitKycInput): Promise<KycResult> {
    const id = `mock_kyc_${hash(`${input.fullName}|${input.dateOfBirth}|${input.churchId}`)}`;
    if (shouldDecline(input.fullName)) {
      return {
        i2cKycId: id,
        status: 'rejected',
        rejectionReason: 'mock: name matched decline rule',
        raw: { mock: true, decision: 'rejected', request: input },
      };
    }
    return {
      i2cKycId: id,
      status: 'approved',
      expiresAt: future(365),
      raw: { mock: true, decision: 'approved', request: input },
    };
  },

  async issueCard(input: IssueCardInput): Promise<IssueCardResult> {
    const id = `mock_card_${hash(`${input.kycVerificationId}|${input.cardholderName}|${Math.floor(Date.now() / 60_000)}`)}`;
    // last4 must be digits — real PANs are numeric. Derive from the
    // numeric value of the hash, modulo 10000, zero-padded.
    const numericSeed = parseInt(hash(id).replace(/[^0-9]/g, '') || '0', 10) || id.length;
    const last4 = String(numericSeed % 10000).padStart(4, '0');
    const now = new Date();
    return {
      i2cCardId: id,
      maskedPan: `••••${last4}`,
      expiryMonth: ((now.getUTCMonth() + 1) % 12) || 12,
      expiryYear: now.getUTCFullYear() + 3,
      status: 'active',
      raw: { mock: true, request: input },
    };
  },

  async freezeCard(input: CardActionInput): Promise<CardActionResult> {
    return { i2cCardId: input.i2cCardId, status: 'frozen', raw: { mock: true, action: 'freeze', reason: input.reason } };
  },

  async unfreezeCard(input: CardActionInput): Promise<CardActionResult> {
    return { i2cCardId: input.i2cCardId, status: 'active', raw: { mock: true, action: 'unfreeze' } };
  },

  async cancelCard(input: CardActionInput): Promise<CardActionResult> {
    return { i2cCardId: input.i2cCardId, status: 'cancelled', raw: { mock: true, action: 'cancel', reason: input.reason } };
  },
};
