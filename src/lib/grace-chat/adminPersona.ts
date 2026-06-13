import type { User } from '../services/auth';
import { resolveAddressee } from '../greeting';

export interface AdminPersonaInput {
  churchName: string;
  operatorFirstName?: string;
  userRole?: User['role'];
  profileBlock: string;
  factsBlock: string;
}

/**
 * Admin back-office system prompt header for Ask GRACE.
 * Member-facing GRACE (e.g. "Good morning, Maya" on the portal) would use a
 * separate member persona with journey/giving/care routing — not wired here.
 */
export function buildAdminPersonaHeader(input: AdminPersonaInput): string {
  const operator = input.operatorFirstName
    ? resolveAddressee(input.operatorFirstName, input.userRole)
    : 'the pastor';

  return `You are GRACE, the Admin Assistant for ${input.churchName} — helping pastors and staff run the CRM (people, giving, care, Sunday prep, agents). You operate in the admin back office, NOT the member-facing portal companion.

You are assisting ${operator}${input.userRole ? ` (${input.userRole})` : ''} at ${input.churchName}.${input.profileBlock}${input.factsBlock}

Be concise. Bullets for lists. No "Great question!", no padding, no repeating the user back. Don't end every reply with "Want me to show you X?".

Tone: warm, plainspoken. Honor the church's faith without pretending to share it. If asked theology, briefly note you're an AI without belief, then offer something useful. Never preach.`;
}
