import { describe, it, expect } from 'vitest';
import {
  validate,
  str,
  email_,
  uuid_,
  bool_,
  int_,
  arrayOfStr,
} from './validation.js';

describe('validation/str', () => {
  it('accepts string within bounds', () => {
    const r = str({ min: 1, max: 10 })('hello', 'name');
    expect(r).toEqual({ ok: true, value: 'hello' });
  });

  it('trims by default', () => {
    expect(str()('  hi  ', 'name')).toEqual({ ok: true, value: 'hi' });
  });

  it('rejects non-string', () => {
    expect(str()(42, 'name').ok).toBe(false);
    expect(str()({} as unknown, 'name').ok).toBe(false);
  });

  it('treats missing as undefined when not required', () => {
    expect(str()(undefined, 'name')).toEqual({ ok: true, value: undefined });
    expect(str()(null, 'name')).toEqual({ ok: true, value: undefined });
  });

  it('errors on missing when required', () => {
    expect(str({ required: true })(undefined, 'name').ok).toBe(false);
  });

  it('treats whitespace-only as missing when required', () => {
    expect(str({ required: true })('   ', 'name').ok).toBe(false);
  });

  it('enforces min/max length on the TRIMMED value', () => {
    expect(str({ min: 3 })('  ab  ', 'name').ok).toBe(false);
    expect(str({ max: 5 })('   abcdef   ', 'name').ok).toBe(false);
    expect(str({ max: 5 })('  abc  ', 'name').ok).toBe(true);
  });

  it('applies pattern', () => {
    const v = str({ pattern: /^[a-z]+$/ });
    expect(v('abc', 'name').ok).toBe(true);
    expect(v('Abc', 'name').ok).toBe(false);
    expect(v('123', 'name').ok).toBe(false);
  });
});

describe('validation/email_', () => {
  it('accepts valid emails', () => {
    const r = email_({ required: true })('Alice@Example.com', 'email');
    expect(r).toEqual({ ok: true, value: 'alice@example.com' });
  });

  it('rejects malformed', () => {
    expect(email_()('not-an-email', 'email').ok).toBe(false);
    expect(email_()('foo@bar', 'email').ok).toBe(false);
    expect(email_()('foo@.com', 'email').ok).toBe(false);
  });

  it('respects max length', () => {
    const long = 'a'.repeat(310) + '@b.co';
    expect(email_({ max: 100 })(long, 'email').ok).toBe(false);
  });
});

describe('validation/uuid_', () => {
  it('accepts UUID v4 / v7 shapes (case-insensitive)', () => {
    expect(uuid_()('11111111-1111-1111-1111-111111111111', 'id').ok).toBe(true);
    expect(uuid_()('AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA', 'id').ok).toBe(true);
  });

  it('rejects non-UUIDs', () => {
    expect(uuid_()('not-uuid', 'id').ok).toBe(false);
    expect(uuid_()('11111111-1111-1111-1111-1111111111', 'id').ok).toBe(false);   // short
    expect(uuid_()(42, 'id').ok).toBe(false);
  });

  it('required vs optional', () => {
    expect(uuid_({ required: true })(undefined, 'id').ok).toBe(false);
    expect(uuid_({ required: false })(undefined, 'id').ok).toBe(true);
  });
});

describe('validation/bool_, int_', () => {
  it('bool_ accepts only true/false', () => {
    expect(bool_()(true, 'x').ok).toBe(true);
    expect(bool_()('true', 'x').ok).toBe(false);
    expect(bool_()(1, 'x').ok).toBe(false);
  });

  it('int_ rejects floats and non-numbers', () => {
    expect(int_()(42, 'n').ok).toBe(true);
    expect(int_()(3.14, 'n').ok).toBe(false);
    expect(int_()('5', 'n').ok).toBe(false);
    expect(int_()(NaN, 'n').ok).toBe(false);
  });

  it('int_ enforces bounds', () => {
    expect(int_({ min: 1, max: 10 })(0, 'n').ok).toBe(false);
    expect(int_({ min: 1, max: 10 })(11, 'n').ok).toBe(false);
    expect(int_({ min: 1, max: 10 })(5, 'n').ok).toBe(true);
  });
});

describe('validation/arrayOfStr', () => {
  it('trims items and drops empty', () => {
    const r = arrayOfStr()(['  a  ', '', 'b', '  '], 'tags');
    expect(r).toEqual({ ok: true, value: ['a', 'b'] });
  });

  it('rejects non-arrays + bad items', () => {
    expect(arrayOfStr()('a,b' as unknown, 'tags').ok).toBe(false);
    expect(arrayOfStr()([1, 2] as unknown, 'tags').ok).toBe(false);
  });

  it('honors allow-list', () => {
    expect(arrayOfStr({ allow: ['x', 'y'] })(['x', 'y'], 'tags').ok).toBe(true);
    expect(arrayOfStr({ allow: ['x', 'y'] })(['x', 'z'], 'tags').ok).toBe(false);
  });

  it('caps array length + item length', () => {
    expect(arrayOfStr({ maxLength: 2 })(['a', 'b', 'c'], 'tags').ok).toBe(false);
    expect(arrayOfStr({ maxItem: 3 })(['toolong'], 'tags').ok).toBe(false);
  });
});

describe('validation/validate aggregator', () => {
  const schema = {
    firstName: str({ required: true, max: 100 }),
    email:     email_({ required: true }),
    churchId:  uuid_({ required: true }),
    age:       int_({ min: 0, max: 150 }),
    tags:      arrayOfStr({ maxLength: 10 }),
  };

  it('returns typed result on success', () => {
    const r = validate(
      {
        firstName: 'Sarah',
        email: 'sarah@example.com',
        churchId: '11111111-1111-1111-1111-111111111111',
        age: 30,
        tags: ['member'],
      },
      schema,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.firstName).toBe('Sarah');
      expect(r.value.email).toBe('sarah@example.com');
      expect(r.value.tags).toEqual(['member']);
    }
  });

  it('reports first field error with path', () => {
    const r = validate({ firstName: 'a', email: 'bad' }, schema);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.path).toBe('email');
      expect(r.error).toMatch(/valid email/);
    }
  });

  it('rejects non-object bodies', () => {
    expect(validate(null, schema).ok).toBe(false);
    expect(validate('hello', schema).ok).toBe(false);
    expect(validate([], schema).ok).toBe(false);
  });

  it('reports missing required field by name', () => {
    const r = validate({ email: 'a@b.co' }, schema);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.path).toBe('firstName');
    }
  });
});
