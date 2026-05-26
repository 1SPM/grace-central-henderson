/**
 * i2c neobank adapter types.
 *
 * The adapter exposes one interface; two implementations:
 *   - liveI2cAdapter (uses real i2c sandbox/production API)
 *   - mockI2cAdapter (deterministic in-memory responses)
 *
 * The selector at api/_lib/i2c/index.ts picks based on
 * I2C_API_KEY + the PostHog flag I2C_LIVE.
 *
 * Mock mode produces realistic-shaped data so the UI works
 * end-to-end without any i2c sandbox account.
 */

export type KycStatus = 'pending' | 'in_review' | 'approved' | 'rejected' | 'expired';
export type CardStatus = 'pending' | 'active' | 'frozen' | 'cancelled' | 'expired';

export interface SubmitKycInput {
  fullName: string;
  dateOfBirth: string;                 // YYYY-MM-DD
  email: string;
  phone?: string;
  /** Per-tenant context for the i2c sub-account. */
  churchId: string;
}

export interface KycResult {
  i2cKycId: string;
  status: KycStatus;
  rejectionReason?: string;
  expiresAt?: string;                  // ISO 8601
  /** Raw upstream response for audit. */
  raw: unknown;
}

export interface IssueCardInput {
  churchId: string;
  kycVerificationId: string;
  cardholderName: string;
  dailyLimitMicroUsd?: number;
  monthlyLimitMicroUsd?: number;
}

export interface IssueCardResult {
  i2cCardId: string;
  maskedPan: string;                   // '••••1234'
  expiryMonth: number;
  expiryYear: number;
  status: CardStatus;
  raw: unknown;
}

export interface CardActionInput {
  i2cCardId: string;
  reason?: string;
}

export interface CardActionResult {
  i2cCardId: string;
  status: CardStatus;
  raw: unknown;
}

export interface I2cAdapter {
  mode: 'live' | 'mock';
  submitKyc(input: SubmitKycInput): Promise<KycResult>;
  issueCard(input: IssueCardInput): Promise<IssueCardResult>;
  freezeCard(input: CardActionInput): Promise<CardActionResult>;
  unfreezeCard(input: CardActionInput): Promise<CardActionResult>;
  cancelCard(input: CardActionInput): Promise<CardActionResult>;
}
