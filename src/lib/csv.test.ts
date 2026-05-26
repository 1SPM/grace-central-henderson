import { describe, it, expect } from 'vitest';
import {
  parseCsv,
  autoDetectPeopleMapping,
  validatePeopleRows,
  autoDetectGivingMapping,
  validateGivingRows,
  type PeopleField,
  type GivingField,
} from './csv';

describe('parseCsv', () => {
  it('parses a simple CSV', () => {
    const { headers, rows } = parseCsv('a,b,c\n1,2,3\n4,5,6');
    expect(headers).toEqual(['a', 'b', 'c']);
    expect(rows).toEqual([
      { a: '1', b: '2', c: '3' },
      { a: '4', b: '5', c: '6' },
    ]);
  });

  it('handles quoted fields with commas inside', () => {
    const { rows } = parseCsv('a,b\n"hello, world",bar');
    expect(rows[0]).toEqual({ a: 'hello, world', b: 'bar' });
  });

  it('handles escaped quotes inside quoted fields', () => {
    const { rows } = parseCsv('a,b\n"he said ""hi""",bar');
    expect(rows[0]).toEqual({ a: 'he said "hi"', b: 'bar' });
  });

  it('handles \\r\\n line endings', () => {
    const { rows } = parseCsv('a,b\r\n1,2\r\n3,4');
    expect(rows).toEqual([{ a: '1', b: '2' }, { a: '3', b: '4' }]);
  });

  it('strips BOM', () => {
    const { headers } = parseCsv('﻿a,b,c\n1,2,3');
    expect(headers).toEqual(['a', 'b', 'c']);
  });

  it('skips empty lines', () => {
    const { rows } = parseCsv('a,b\n1,2\n\n3,4\n');
    expect(rows).toEqual([{ a: '1', b: '2' }, { a: '3', b: '4' }]);
  });

  it('warns on duplicate headers', () => {
    const { warnings } = parseCsv('email,name,email\n1,2,3');
    expect(warnings.some((w) => w.includes('duplicate'))).toBe(true);
  });

  it('warns on blank header', () => {
    const { warnings, headers } = parseCsv('a,,c\n1,2,3');
    expect(warnings.some((w) => w.includes('blank header'))).toBe(true);
    expect(headers).toEqual(['a', 'c']);
  });

  it('returns empty for empty input', () => {
    const result = parseCsv('');
    expect(result.headers).toEqual([]);
    expect(result.rows).toEqual([]);
  });
});

describe('autoDetectPeopleMapping', () => {
  it('matches common Planning Center / Breeze exports', () => {
    const mapping = autoDetectPeopleMapping([
      'First Name', 'Last Name', 'Email', 'Phone', 'Birthday', 'Address', 'City', 'State', 'Zip',
    ]);
    expect(mapping.first_name).toBe('First Name');
    expect(mapping.last_name).toBe('Last Name');
    expect(mapping.email).toBe('Email');
    expect(mapping.phone).toBe('Phone');
    expect(mapping.birth_date).toBe('Birthday');
    expect(mapping.city).toBe('City');
  });

  it('case + punctuation insensitive', () => {
    const mapping = autoDetectPeopleMapping(['firstname', 'last-name', 'Phone_Number']);
    expect(mapping.first_name).toBe('firstname');
    expect(mapping.last_name).toBe('last-name');
    expect(mapping.phone).toBe('Phone_Number');
  });

  it('handles alternate names', () => {
    const m = autoDetectPeopleMapping(['Given Name', 'Surname', 'E-mail', 'Mobile', 'DOB', 'Postal Code']);
    expect(m.first_name).toBe('Given Name');
    expect(m.last_name).toBe('Surname');
    expect(m.email).toBe('E-mail');
    expect(m.phone).toBe('Mobile');
    expect(m.birth_date).toBe('DOB');
    expect(m.zip).toBe('Postal Code');
  });

  it('leaves unmatched fields absent', () => {
    const m = autoDetectPeopleMapping(['just', 'random', 'columns']);
    expect(Object.keys(m).length).toBe(0);
  });
});

describe('validatePeopleRows', () => {
  const mapping: Partial<Record<PeopleField, string>> = {
    first_name: 'First',
    last_name: 'Last',
    email: 'Email',
    phone: 'Phone',
    birth_date: 'Birthday',
  };

  it('accepts valid rows', () => {
    const result = validatePeopleRows(
      [
        { First: 'Sarah', Last: 'Jones', Email: 'sarah@x.com', Phone: '512-555-1234', Birthday: '1985-03-15' },
        { First: 'Bob', Last: 'Smith', Email: 'bob@y.com', Phone: '', Birthday: '' },
      ],
      mapping,
    );
    expect(result.valid).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
    expect(result.valid[0].email).toBe('sarah@x.com');
    expect(result.valid[0].birth_date).toBe('1985-03-15');
    expect(result.valid[1].email).toBe('bob@y.com');
    expect(result.valid[1].birth_date).toBeNull();
  });

  it('skips rows with no name', () => {
    const result = validatePeopleRows(
      [{ First: '', Last: '', Email: 'a@b.com' }],
      mapping,
    );
    expect(result.valid).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toMatch(/no name/);
  });

  it('rejects malformed email', () => {
    const result = validatePeopleRows(
      [{ First: 'A', Last: 'B', Email: 'not-an-email' }],
      mapping,
    );
    expect(result.valid).toHaveLength(0);
    expect(result.errors[0].field).toBe('email');
  });

  it('flags duplicate emails inside the upload', () => {
    const result = validatePeopleRows(
      [
        { First: 'A', Last: 'B', Email: 'same@x.com' },
        { First: 'C', Last: 'D', Email: 'same@x.com' },
      ],
      mapping,
    );
    expect(result.valid).toHaveLength(2);   // both still imported
    expect(result.duplicateEmails).toContain('same@x.com');
  });

  it('parses MM/DD/YYYY US dates', () => {
    const result = validatePeopleRows(
      [{ First: 'A', Last: 'B', Birthday: '03/15/1985' }],
      mapping,
    );
    expect(result.valid[0].birth_date).toBe('1985-03-15');
  });

  it('parses M/D/YY US dates with 2-digit year', () => {
    const result = validatePeopleRows(
      [
        { First: 'A', Last: 'B', Birthday: '3/15/85' },  // 1985 (>=30)
        { First: 'C', Last: 'D', Birthday: '3/15/15' },  // 2015 (<30)
      ],
      mapping,
    );
    expect(result.valid[0].birth_date).toBe('1985-03-15');
    expect(result.valid[1].birth_date).toBe('2015-03-15');
  });

  it('rejects invalid dates', () => {
    const result = validatePeopleRows(
      [{ First: 'A', Last: 'B', Birthday: '02/30/1985' }],
      mapping,
    );
    expect(result.errors[0].field).toBe('birth_date');
  });

  it('lowercases emails', () => {
    const result = validatePeopleRows(
      [{ First: 'A', Last: 'B', Email: 'CAPS@EXAMPLE.COM' }],
      mapping,
    );
    expect(result.valid[0].email).toBe('caps@example.com');
  });

  it('truncates oversize strings', () => {
    const result = validatePeopleRows(
      [{ First: 'A', Last: 'B', Email: 'a@b.com', Phone: '+1 (512) 555-1234' }],
      { ...mapping, address: 'Addr' } as Partial<Record<PeopleField, string>>,
    );
    expect(result.valid[0].phone).toBe('+1 (512) 555-1234');
  });

  it('rejects phone with non-numeric chars', () => {
    const result = validatePeopleRows(
      [{ First: 'A', Last: 'B', Phone: 'call me' }],
      mapping,
    );
    expect(result.errors[0].field).toBe('phone');
  });
});

describe('autoDetectGivingMapping', () => {
  it('matches common giving CSV headers', () => {
    const m = autoDetectGivingMapping([
      'Email', 'Donor Name', 'Amount', 'Date', 'Fund', 'Payment Method', 'Memo',
    ]);
    expect(m.donor_email).toBe('Email');
    expect(m.donor_name).toBe('Donor Name');
    expect(m.amount).toBe('Amount');
    expect(m.date).toBe('Date');
    expect(m.fund).toBe('Fund');
    expect(m.method).toBe('Payment Method');
    expect(m.note).toBe('Memo');
  });

  it('handles Planning Center / Breeze variants', () => {
    const m = autoDetectGivingMapping([
      'Donor Email Address', 'Giver Name', 'Gift Amount', 'Donation Date', 'Designation', 'Check Number',
    ]);
    expect(m.donor_email).toBe('Donor Email Address');
    expect(m.donor_name).toBe('Giver Name');
    expect(m.amount).toBe('Gift Amount');
    expect(m.date).toBe('Donation Date');
    expect(m.fund).toBe('Designation');
    expect(m.check_number).toBe('Check Number');
  });
});

describe('validateGivingRows', () => {
  const mapping: Partial<Record<GivingField, string>> = {
    donor_email: 'Email',
    donor_name: 'Name',
    amount: 'Amount',
    date: 'Date',
    fund: 'Fund',
    method: 'Method',
  };

  it('parses dollars, cents, $sign, commas, parens-negative', () => {
    const result = validateGivingRows(
      [
        { Email: 'a@x.com', Name: 'A', Amount: '$1,234.56', Date: '2025-01-15' },
        { Email: 'b@x.com', Name: 'B', Amount: '500', Date: '2025-01-15' },
        { Email: 'c@x.com', Name: 'C', Amount: '(50)', Date: '2025-01-15' },  // refund
      ],
      mapping,
    );
    expect(result.valid).toHaveLength(3);
    expect(result.valid[0].amount_cents).toBe(123456);
    expect(result.valid[1].amount_cents).toBe(50000);
    expect(result.valid[2].amount_cents).toBe(-5000);   // negative for refund
  });

  it('requires amount and date', () => {
    const result = validateGivingRows(
      [
        { Email: 'a@x.com', Name: 'A', Amount: '', Date: '2025-01-15' },
        { Email: 'b@x.com', Name: 'B', Amount: '100', Date: '' },
      ],
      mapping,
    );
    expect(result.valid).toHaveLength(0);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0].field).toBe('amount');
    expect(result.errors[1].field).toBe('date');
  });

  it('rejects zero amount', () => {
    const result = validateGivingRows(
      [{ Email: 'a@x.com', Name: 'A', Amount: '0', Date: '2025-01-15' }],
      mapping,
    );
    expect(result.valid).toHaveLength(0);
    expect(result.errors[0].message).toMatch(/zero/);
  });

  it('imports unmatched-by-email rows with warning', () => {
    const result = validateGivingRows(
      [{ Email: 'not-an-email', Name: 'A', Amount: '100', Date: '2025-01-15' }],
      mapping,
    );
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].donor_email).toBeNull();
    expect(result.errors.find((e) => e.field === 'donor_email')).toBeDefined();
  });

  it('imports anonymous donations (no email + no name)', () => {
    const result = validateGivingRows(
      [{ Email: '', Name: '', Amount: '50', Date: '2025-01-15' }],
      mapping,
    );
    expect(result.valid).toHaveLength(1);
    expect(result.errors.find((e) => e.message.includes('anonymous'))).toBeDefined();
  });

  it('normalizes common payment methods', () => {
    const result = validateGivingRows(
      [
        { Email: 'a@x.com', Amount: '10', Date: '2025-01-01', Method: 'Cash' },
        { Email: 'b@x.com', Amount: '10', Date: '2025-01-01', Method: 'Check' },
        { Email: 'c@x.com', Amount: '10', Date: '2025-01-01', Method: 'Credit Card' },
        { Email: 'd@x.com', Amount: '10', Date: '2025-01-01', Method: 'ACH' },
      ],
      mapping,
    );
    expect(result.valid[0].method).toBe('cash');
    expect(result.valid[1].method).toBe('check');
    expect(result.valid[2].method).toBe('credit_card');
    expect(result.valid[3].method).toBe('ach');
  });

  it('defaults fund to "general" when missing', () => {
    const result = validateGivingRows(
      [{ Email: 'a@x.com', Amount: '100', Date: '2025-01-15' }],
      mapping,
    );
    expect(result.valid[0].fund).toBe('general');
  });

  it('returns distinct donor emails for pre-fetch', () => {
    const result = validateGivingRows(
      [
        { Email: 'a@x.com', Amount: '10', Date: '2025-01-01' },
        { Email: 'b@x.com', Amount: '20', Date: '2025-01-02' },
        { Email: 'a@x.com', Amount: '30', Date: '2025-01-03' },  // dup
      ],
      mapping,
    );
    expect(result.donorEmails.sort()).toEqual(['a@x.com', 'b@x.com']);
  });
});
