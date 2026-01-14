import { describe, it, expect } from 'vitest';
import {
  validatePerson,
  validateTask,
  validatePrayerRequest,
  validateGiving,
  validateCredentialFormat,
  validateDate,
} from './validation';

describe('validation utilities', () => {
  describe('validatePerson', () => {
    it('validates a complete valid person', () => {
      const result = validatePerson({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '555-123-4567',
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('validates person with only required fields', () => {
      const result = validatePerson({
        firstName: 'Jane',
        lastName: 'Smith',
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('requires first name', () => {
      const result = validatePerson({
        firstName: '',
        lastName: 'Doe',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('First name is required');
    });

    it('requires last name', () => {
      const result = validatePerson({
        firstName: 'John',
        lastName: '',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Last name is required');
    });

    it('rejects first name over 100 characters', () => {
      const result = validatePerson({
        firstName: 'a'.repeat(101),
        lastName: 'Doe',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('First name must be 100 characters or less');
    });

    it('rejects invalid characters in first name', () => {
      const result = validatePerson({
        firstName: 'John<script>',
        lastName: 'Doe',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('First name contains invalid characters');
    });

    it('allows hyphens and apostrophes in names', () => {
      const result = validatePerson({
        firstName: "Mary-Jane O'Connor",
        lastName: "Van der Berg-Smith",
      });

      expect(result.isValid).toBe(true);
    });

    it('rejects invalid email format', () => {
      const result = validatePerson({
        firstName: 'John',
        lastName: 'Doe',
        email: 'not-an-email',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid email format');
    });

    it('rejects email over 254 characters', () => {
      const longEmail = 'a'.repeat(250) + '@test.com';
      const result = validatePerson({
        firstName: 'John',
        lastName: 'Doe',
        email: longEmail,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Email must be 254 characters or less');
    });

    it('rejects phone with too few digits', () => {
      const result = validatePerson({
        firstName: 'John',
        lastName: 'Doe',
        phone: '123',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Phone number must be 10-15 digits');
    });

    it('rejects phone with too many digits', () => {
      const result = validatePerson({
        firstName: 'John',
        lastName: 'Doe',
        phone: '1234567890123456',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Phone number must be 10-15 digits');
    });

    it('accepts various valid phone formats', () => {
      const validPhones = [
        '5551234567',
        '555-123-4567',
        '(555) 123-4567',
        '+1 555 123 4567',
        '555.123.4567',
      ];

      validPhones.forEach((phone) => {
        const result = validatePerson({
          firstName: 'John',
          lastName: 'Doe',
          phone,
        });
        expect(result.isValid).toBe(true);
      });
    });
  });

  describe('validateTask', () => {
    it('validates a complete valid task', () => {
      const result = validateTask({
        title: 'Follow up with John',
        dueDate: '2024-02-15',
        description: 'Call to discuss small group',
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('validates task without description', () => {
      const result = validateTask({
        title: 'Send email',
        dueDate: '2024-02-20',
      });

      expect(result.isValid).toBe(true);
    });

    it('requires title', () => {
      const result = validateTask({
        title: '',
        dueDate: '2024-02-15',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Task title is required');
    });

    it('rejects title over 255 characters', () => {
      const result = validateTask({
        title: 'a'.repeat(256),
        dueDate: '2024-02-15',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Task title must be 255 characters or less');
    });

    it('requires due date', () => {
      const result = validateTask({
        title: 'Valid title',
        dueDate: '',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Due date is required');
    });

    it('rejects invalid due date format', () => {
      const result = validateTask({
        title: 'Valid title',
        dueDate: 'not-a-date',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid due date format');
    });

    it('rejects description over 5000 characters', () => {
      const result = validateTask({
        title: 'Valid title',
        dueDate: '2024-02-15',
        description: 'a'.repeat(5001),
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Description must be 5000 characters or less');
    });
  });

  describe('validatePrayerRequest', () => {
    it('validates a complete prayer request', () => {
      const result = validatePrayerRequest({
        content: 'Please pray for healing',
        personId: 'person-123',
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('requires content', () => {
      const result = validatePrayerRequest({
        content: '',
        personId: 'person-123',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Prayer request content is required');
    });

    it('rejects content over 5000 characters', () => {
      const result = validatePrayerRequest({
        content: 'a'.repeat(5001),
        personId: 'person-123',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Prayer request must be 5000 characters or less');
    });

    it('requires personId', () => {
      const result = validatePrayerRequest({
        content: 'Valid prayer content',
        personId: '',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Person is required');
    });
  });

  describe('validateGiving', () => {
    it('validates a complete donation', () => {
      const result = validateGiving({
        amount: 100.50,
        personId: 'person-123',
        fund: 'tithe',
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('validates donation without personId (anonymous)', () => {
      const result = validateGiving({
        amount: 50,
        fund: 'offering',
      });

      expect(result.isValid).toBe(true);
    });

    it('requires valid amount', () => {
      const result = validateGiving({
        amount: NaN,
        fund: 'tithe',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Valid amount is required');
    });

    it('requires positive amount', () => {
      const result = validateGiving({
        amount: -10,
        fund: 'tithe',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Amount must be greater than 0');
    });

    it('requires zero amount to be positive', () => {
      const result = validateGiving({
        amount: 0,
        fund: 'tithe',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Amount must be greater than 0');
    });

    it('rejects excessive amounts', () => {
      const result = validateGiving({
        amount: 1000000001,
        fund: 'tithe',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Amount exceeds maximum allowed');
    });

    it('validates all valid fund types', () => {
      const validFunds = ['tithe', 'offering', 'missions', 'building', 'other'];

      validFunds.forEach((fund) => {
        const result = validateGiving({
          amount: 100,
          fund,
        });
        expect(result.isValid).toBe(true);
      });
    });

    it('rejects invalid fund type', () => {
      const result = validateGiving({
        amount: 100,
        fund: 'invalid-fund',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid fund type');
    });
  });

  describe('validateCredentialFormat', () => {
    describe('resend', () => {
      it('accepts valid Resend API key format', () => {
        expect(validateCredentialFormat('resend', 're_abc123456789')).toBe(true);
      });

      it('rejects key not starting with re_', () => {
        expect(validateCredentialFormat('resend', 'abc123456789')).toBe(false);
      });

      it('rejects too short key', () => {
        expect(validateCredentialFormat('resend', 're_short')).toBe(false);
      });
    });

    describe('twilio', () => {
      it('accepts valid Twilio Account SID format', () => {
        expect(validateCredentialFormat('twilio', 'AC' + 'a'.repeat(32))).toBe(true);
      });

      it('accepts valid Twilio Auth Token format (32 chars)', () => {
        expect(validateCredentialFormat('twilio', 'a'.repeat(32))).toBe(true);
      });

      it('rejects invalid Twilio SID', () => {
        expect(validateCredentialFormat('twilio', 'AC_short')).toBe(false);
      });

      it('rejects wrong length token', () => {
        expect(validateCredentialFormat('twilio', 'a'.repeat(31))).toBe(false);
      });
    });

    describe('stripe', () => {
      it('accepts valid Stripe secret key format', () => {
        expect(validateCredentialFormat('stripe', 'sk_live_' + 'a'.repeat(24))).toBe(true);
      });

      it('accepts valid Stripe publishable key format', () => {
        expect(validateCredentialFormat('stripe', 'pk_test_' + 'a'.repeat(24))).toBe(true);
      });

      it('rejects key not starting with sk_ or pk_', () => {
        expect(validateCredentialFormat('stripe', 'rk_' + 'a'.repeat(24))).toBe(false);
      });

      it('rejects too short key', () => {
        expect(validateCredentialFormat('stripe', 'sk_short')).toBe(false);
      });
    });

    it('handles empty string', () => {
      expect(validateCredentialFormat('resend', '')).toBe(false);
      expect(validateCredentialFormat('twilio', '')).toBe(false);
      expect(validateCredentialFormat('stripe', '')).toBe(false);
    });

    it('handles null/undefined safely', () => {
      expect(validateCredentialFormat('resend', null as unknown as string)).toBe(false);
      expect(validateCredentialFormat('twilio', undefined as unknown as string)).toBe(false);
    });
  });

  describe('validateDate', () => {
    it('validates a valid date string', () => {
      const result = validateDate('2024-02-15');

      expect(result.isValid).toBe(true);
      expect(result.date).toBeInstanceOf(Date);
    });

    it('validates ISO date format', () => {
      const result = validateDate('2024-02-15T10:30:00Z');

      expect(result.isValid).toBe(true);
      expect(result.date?.getFullYear()).toBe(2024);
    });

    it('rejects empty string', () => {
      const result = validateDate('');

      expect(result.isValid).toBe(false);
      expect(result.date).toBeNull();
    });

    it('rejects invalid date string', () => {
      const result = validateDate('not-a-date');

      expect(result.isValid).toBe(false);
      expect(result.date).toBeNull();
    });

    it('rejects date before 1900', () => {
      const result = validateDate('1899-12-31');

      expect(result.isValid).toBe(false);
      expect(result.date).toBeNull();
    });

    it('rejects date after 2100', () => {
      const result = validateDate('2101-01-01');

      expect(result.isValid).toBe(false);
      expect(result.date).toBeNull();
    });

    it('accepts boundary dates (1900 and 2100)', () => {
      expect(validateDate('1900-01-01').isValid).toBe(true);
      expect(validateDate('2100-12-31').isValid).toBe(true);
    });
  });
});
