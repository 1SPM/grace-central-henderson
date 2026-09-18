/**
 * The story allowlist is the only thing standing between "a member's tutorial
 * answers" and "whatever the client decided to POST". Its failures must be
 * loud: docs/MEMBER_MOBILE_HANDOFF.md requires an invalid-input test and an
 * oversized-input test, and a silent drop would let the client and this list
 * drift apart until neither is authoritative.
 */
import { describe, it, expect } from 'vitest';
import {
  validateSections, validateSegments,
  MAX_ITEM_CHARS, MAX_SECTION_ITEMS, MAX_TOTAL_CHARS,
} from './storySegments.js';

describe('validateSections', () => {
  it('accepts the four core sections without money consent', () => {
    const r = validateSections({ church: ['Two years'], connect: ['Groups'] }, false);
    expect(r).toMatchObject({ ok: true, value: { church: ['Two years'], connect: ['Groups'] } });
  });

  it('REFUSES money sections when they were not consented to', () => {
    const r = validateSections({ wallet: ['identity'] }, false);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/money-sections consent/);
  });

  it('accepts money sections once consented', () => {
    const r = validateSections({ impact: ['Food pantry'] }, true);
    expect(r.ok).toBe(true);
  });

  it('rejects an unknown section loudly rather than dropping it', () => {
    const r = validateSections({ journal: ['private thoughts'] }, true);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.path).toBe('sections.journal');
  });

  it.each([
    ['care notes', { careNotes: ['x'] }],
    ['payment data', { payment: ['4111'] }],
    ['identifiers', { clerk_user_id: ['user_1'] }],
  ])('rejects %s, which must never travel', (_label, payload) => {
    expect(validateSections(payload, true).ok).toBe(false);
  });

  it('rejects an over-long item', () => {
    const r = validateSections({ church: ['x'.repeat(MAX_ITEM_CHARS + 1)] }, false);
    expect(r.ok).toBe(false);
  });

  it('rejects too many items in one section', () => {
    const r = validateSections({ church: Array(MAX_SECTION_ITEMS + 1).fill('x') }, false);
    expect(r.ok).toBe(false);
  });

  it('rejects an oversized total payload', () => {
    const big = 'x'.repeat(MAX_ITEM_CHARS);
    const r = validateSections({
      church: Array(6).fill(big), connect: Array(6).fill(big),
      reflect: Array(6).fill(big), leadership: Array(6).fill(big),
    }, false);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(new RegExp(String(MAX_TOTAL_CHARS)));
  });

  it('drops empty strings without failing, and omits a section left blank', () => {
    const r = validateSections({ church: ['', '   '] }, false);
    expect(r).toMatchObject({ ok: true, value: {} });
  });

  it('rejects a non-array section and a non-string item', () => {
    expect(validateSections({ church: 'nope' }, false).ok).toBe(false);
    expect(validateSections({ church: [42] }, false).ok).toBe(false);
  });

  it('treats a missing payload as empty rather than an error', () => {
    expect(validateSections(undefined, false)).toMatchObject({ ok: true, value: {} });
  });
});

describe('validateSegments', () => {
  it('accepts valid enum values', () => {
    const r = validateSegments({ age_band: '35_44', language_preference: 'es' });
    expect(r).toMatchObject({ ok: true, value: { age_band: '35_44', language_preference: 'es' } });
  });

  it('rejects a value outside the enum', () => {
    const r = validateSegments({ age_band: '35' });
    expect(r.ok).toBe(false);
  });

  it('rejects an unknown segment field', () => {
    expect(validateSegments({ income_bracket: 'high' }).ok).toBe(false);
  });

  it('does not store an explicit decline as though it were an answer', () => {
    const r = validateSegments({ age_band: 'prefer_not_to_say', attendance_mode: 'both' });
    expect(r).toMatchObject({ ok: true, value: { attendance_mode: 'both' } });
  });

  it('offers a decline on every field, so none is compulsory', () => {
    const r = validateSegments({
      age_band: 'prefer_not_to_say', language_preference: 'prefer_not_to_say',
      attendance_mode: 'prefer_not_to_say', digital_confidence: 'prefer_not_to_say',
    });
    expect(r).toMatchObject({ ok: true, value: {} });
  });

  it('carries no numeric confidence scale — a score about a member is not built here', () => {
    const r = validateSegments({ digital_confidence: '3' });
    expect(r.ok).toBe(false);
  });
});
