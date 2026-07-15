/**
 * Volunteer opportunity catalog.
 *
 * No dedicated `volunteer_opportunities` table exists yet — this phase
 * ships a small, church-configurable-in-code list rather than inventing
 * a new admin-managed catalog table, since that's a larger feature than
 * "express volunteer interest" requires today. Tracked in TECH_DEBT.md
 * as the natural next step once a church wants to manage this list
 * itself instead of via a code change.
 */

export interface VolunteerOpportunity {
  key: string;
  title: string;
  description: string;
}

export const VOLUNTEER_OPPORTUNITIES: VolunteerOpportunity[] = [
  { key: 'food_pantry', title: 'Food Pantry', description: 'Saturdays — help sort and distribute groceries.' },
  { key: 'greeting_team', title: 'Greeting Team', description: 'Sundays — welcome members and visitors at the door.' },
  { key: 'youth_mentors', title: 'Youth Mentors', description: 'Wednesdays — mentor students in the youth program.' },
];
