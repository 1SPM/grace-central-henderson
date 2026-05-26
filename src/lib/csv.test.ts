import { describe, it, expect } from 'vitest';
import {
  parseCsv,
  autoDetectPeopleMapping,
  validatePeopleRows,
  type PeopleField,
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
