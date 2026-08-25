/**
 * Tenant-resolved leadership roster. Central Henderson and Faithful each keep
 * their own data module (centralHendersonLeaders.ts / faithfulChurchLeaders.ts);
 * every other file should import from HERE, not from either tenant module
 * directly, so the Leadership hub, People, and GRACE FAQ never leak one
 * tenant's clergy/staff into another's.
 */
import { getTenant } from './tenant';
import type { LeaderProfile, Person } from '../types';
import type { LeaderHubStats, LeaderCompanionConfig, GraceFaqItem } from './leaderTypes';
import * as central from './centralHendersonLeaders';
import * as faithful from './faithfulChurchLeaders';

export type { LeaderHubStats, LeaderCompanionConfig, GraceFaqItem };
export { EXPERTISE_DISPLAY_LABELS, getExpertiseDisplayTags } from './leaderTypes';

const IS_FAITHFUL = getTenant().id === 'faithful';

export const LEADERS: LeaderProfile[] = IS_FAITHFUL ? faithful.FAITHFUL_CHURCH_LEADERS : central.CENTRAL_HENDERSON_LEADERS;
export const LEADER_STATS: Record<string, LeaderHubStats> = IS_FAITHFUL
  ? faithful.FAITHFUL_CHURCH_LEADER_STATS
  : central.CENTRAL_HENDERSON_LEADER_STATS;
export const COMPANION_CONFIG: Record<string, LeaderCompanionConfig> = IS_FAITHFUL
  ? faithful.FAITHFUL_CHURCH_COMPANION_CONFIG
  : central.CENTRAL_HENDERSON_COMPANION_CONFIG;
export const STAFF_PERSON_IDS: readonly string[] = IS_FAITHFUL ? faithful.FAITHFUL_STAFF_PERSON_IDS : central.CENTRAL_STAFF_PERSON_IDS;
export const LEADER_PHOTOS: Record<string, string> = IS_FAITHFUL
  ? faithful.FAITHFUL_CHURCH_LEADER_PHOTOS
  : central.CENTRAL_HENDERSON_LEADER_PHOTOS;
export const GRACE_AI_FAQ: GraceFaqItem[] = IS_FAITHFUL ? faithful.FAITHFUL_GRACE_AI_FAQ : central.GRACE_AI_FAQ;
export const MASTER_ADMIN_LEADER_ID: string = IS_FAITHFUL ? faithful.MASTER_ADMIN_LEADER_ID : central.MASTER_ADMIN_LEADER_ID;

export function getLeaderPhoto(leaderId: string): string | undefined {
  return IS_FAITHFUL ? faithful.getLeaderPhoto(leaderId) : central.getLeaderPhoto(leaderId);
}

export function getLeaderPhotoByPersonId(personId: string): string | undefined {
  return IS_FAITHFUL ? faithful.getLeaderPhotoByPersonId(personId) : central.getLeaderPhotoByPersonId(personId);
}

export function getLeaderByPersonId(personId: string): LeaderProfile | undefined {
  return IS_FAITHFUL ? faithful.getLeaderByPersonId(personId) : central.getLeaderByPersonId(personId);
}

/** Is this person id one of the tenant's canonical staff/clergy roster? */
export function isTenantStaffPerson(personId: string): boolean {
  return IS_FAITHFUL ? faithful.isFaithfulStaffPerson(personId) : central.isCentralStaffPerson(personId);
}

export function isPastoralStaffTags(tags: string[]): boolean {
  return tags.includes('pastoral-staff');
}

export function isPastoralStaffRecord(personId: string, tags: string[]): boolean {
  return isPastoralStaffTags(tags) || isTenantStaffPerson(personId);
}

export function getLeaderCompanionConfig(leaderId: string): LeaderCompanionConfig | undefined {
  return IS_FAITHFUL ? faithful.getLeaderCompanionConfig(leaderId) : central.getLeaderCompanionConfig(leaderId);
}

export function resolveLeaderContact(leader: LeaderProfile, people: Person[] = []): { phone: string; email: string } {
  return IS_FAITHFUL ? faithful.resolveLeaderContact(leader, people) : central.resolveLeaderContact(leader, people);
}
