import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mockI2cAdapter, getI2cAdapter } from './index.js';

describe('i2c/mock-adapter — submitKyc', () => {
  it('approves a normal submission instantly', async () => {
    const r = await mockI2cAdapter.submitKyc({
      churchId: 'c-1',
      fullName: 'Sarah Mendez',
      dateOfBirth: '1985-03-12',
      email: 'sarah@example.com',
    });
    expect(r.status).toBe('approved');
    expect(r.i2cKycId).toMatch(/^mock_kyc_/);
    expect(r.expiresAt).toBeTruthy();
  });

  it('rejects when name contains DECLINE marker', async () => {
    const r = await mockI2cAdapter.submitKyc({
      churchId: 'c-1',
      fullName: 'DECLINE Me',
      dateOfBirth: '1985-03-12',
      email: 'x@example.com',
    });
    expect(r.status).toBe('rejected');
    expect(r.rejectionReason).toMatch(/decline rule/);
  });

  it('is deterministic in id for the same input', async () => {
    const input = { churchId: 'c-1', fullName: 'A B', dateOfBirth: '2000-01-01', email: 'a@b' };
    const a = await mockI2cAdapter.submitKyc(input);
    const b = await mockI2cAdapter.submitKyc(input);
    expect(a.i2cKycId).toBe(b.i2cKycId);
  });
});

describe('i2c/mock-adapter — issueCard', () => {
  it('returns an active card with a masked PAN + valid expiry', async () => {
    const r = await mockI2cAdapter.issueCard({
      churchId: 'c-1',
      kycVerificationId: 'kyc-1',
      cardholderName: 'Sarah Mendez',
    });
    expect(r.status).toBe('active');
    expect(r.i2cCardId).toMatch(/^mock_card_/);
    expect(r.maskedPan).toMatch(/^••••\d{4}$/);
    expect(r.expiryMonth).toBeGreaterThanOrEqual(1);
    expect(r.expiryMonth).toBeLessThanOrEqual(12);
    expect(r.expiryYear).toBeGreaterThanOrEqual(new Date().getUTCFullYear() + 1);
  });
});

describe('i2c/mock-adapter — card actions', () => {
  it('freezeCard returns frozen status', async () => {
    const r = await mockI2cAdapter.freezeCard({ i2cCardId: 'card-x', reason: 'lost' });
    expect(r.status).toBe('frozen');
  });

  it('unfreezeCard returns active status', async () => {
    const r = await mockI2cAdapter.unfreezeCard({ i2cCardId: 'card-x' });
    expect(r.status).toBe('active');
  });

  it('cancelCard returns cancelled status', async () => {
    const r = await mockI2cAdapter.cancelCard({ i2cCardId: 'card-x', reason: 'closed account' });
    expect(r.status).toBe('cancelled');
  });
});

describe('i2c/index — getI2cAdapter selector', () => {
  const origKey = process.env.I2C_API_KEY;
  beforeEach(() => { delete process.env.I2C_API_KEY; });
  afterEach(() => { if (origKey !== undefined) process.env.I2C_API_KEY = origKey; else delete process.env.I2C_API_KEY; });

  it('returns mock when no API key is configured (regardless of liveMode flag)', () => {
    const a = getI2cAdapter({ liveMode: true });
    expect(a.mode).toBe('mock');
  });

  it('returns mock when liveMode is false (regardless of API key)', () => {
    process.env.I2C_API_KEY = 'test-key';
    const a = getI2cAdapter({ liveMode: false });
    expect(a.mode).toBe('mock');
  });

  it('returns live adapter when both liveMode + API key set', () => {
    process.env.I2C_API_KEY = 'test-key';
    const a = getI2cAdapter({ liveMode: true });
    expect(a.mode).toBe('live');
  });
});
