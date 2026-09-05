/**
 * Frontend copy of api/_lib/volunteerOpportunities.ts's catalog (kept in
 * sync manually — both are small and stable; see TECH_DEBT.md for the
 * follow-up to source this from one place, e.g. api/portal/_home.ts
 * already returns it, once the community volunteer form reads
 * opportunities from that response instead of a local constant).
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
