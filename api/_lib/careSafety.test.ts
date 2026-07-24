/**
 * Unit tests for crisis detection, member-safe status mapping, the
 * visibility safety override, and the closure escalation gate.
 * Covers: escalation tests, member-status tests, visibility tests.
 */
import { describe, it, expect } from 'vitest';
import { detectCrisisLanguage, toCareMemberStatus, resolveEffectiveVisibility, canCloseCareRequest } from './careSafety.js';

describe('detectCrisisLanguage', () => {
  it('flags explicit crisis language', () => {
    expect(detectCrisisLanguage('I want to kill myself')).toBe(true);
    expect(detectCrisisLanguage('thinking about suicide lately')).toBe(true);
    expect(detectCrisisLanguage('he keeps hurting me, it feels abusive')).toBe(true);
  });

  it('does not flag ordinary care language', () => {
    expect(detectCrisisLanguage('Could someone pray for my job interview?')).toBe(false);
    expect(detectCrisisLanguage('My marriage has been hard lately')).toBe(false);
  });

  it('handles null/undefined/empty text without throwing', () => {
    expect(detectCrisisLanguage(null)).toBe(false);
    expect(detectCrisisLanguage(undefined)).toBe(false);
    expect(detectCrisisLanguage('')).toBe(false);
  });
});

describe('toCareMemberStatus (member-status test)', () => {
  it('never returns an internal status value verbatim', () => {
    const internal = ['submitted', 'triaged', 'assigned', 'in_progress', 'resolved', 'closed'];
    const approved = ['Received', 'Assigned', 'In Progress', 'Waiting for Information', 'Completed'];
    for (const status of internal) {
      expect(approved).toContain(toCareMemberStatus(status, true));
      expect(approved).toContain(toCareMemberStatus(status, false));
    }
  });

  it('maps submitted to Received regardless of assignment', () => {
    expect(toCareMemberStatus('submitted', false)).toBe('Received');
    expect(toCareMemberStatus('submitted', true)).toBe('Received');
  });

  it('maps resolved and closed both to Completed (internal distinction hidden)', () => {
    expect(toCareMemberStatus('resolved', true)).toBe('Completed');
    expect(toCareMemberStatus('closed', true)).toBe('Completed');
  });
});

describe('resolveEffectiveVisibility (visibility / escalation test)', () => {
  it('honors the member\'s chosen visibility when there is no crisis language', () => {
    expect(resolveEffectiveVisibility('church_prayer_wall', false, 'private_pastoral_care')).toBe('church_prayer_wall');
    expect(resolveEffectiveVisibility('anonymous_prayer_wall', false, 'private_pastoral_care')).toBe('anonymous_prayer_wall');
  });

  it('overrides to the private fallback when crisis language is present, regardless of member choice', () => {
    expect(resolveEffectiveVisibility('church_prayer_wall', true, 'private_pastoral_care')).toBe('private_pastoral_care');
    expect(resolveEffectiveVisibility('anonymous_prayer_wall', true, 'private_pastoral_care')).toBe('private_pastoral_care');
    expect(resolveEffectiveVisibility('selected_group', true, 'private_pastoral_care')).toBe('private_pastoral_care');
  });
});

describe('canCloseCareRequest (escalation test)', () => {
  it('blocks closing/resolving while sentinel review is pending', () => {
    expect(canCloseCareRequest('closed', 'pending')).toBe(false);
    expect(canCloseCareRequest('resolved', 'pending')).toBe(false);
  });

  it('allows closing once review is cleared, flagged, or was never required', () => {
    expect(canCloseCareRequest('closed', 'cleared')).toBe(true);
    expect(canCloseCareRequest('resolved', 'not_required')).toBe(true);
    expect(canCloseCareRequest('closed', 'flagged')).toBe(true);
  });

  it('does not block non-closing status transitions even while review is pending', () => {
    expect(canCloseCareRequest('in_progress', 'pending')).toBe(true);
    expect(canCloseCareRequest('assigned', 'pending')).toBe(true);
  });
});
