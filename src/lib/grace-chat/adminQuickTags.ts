export interface GraceQuickTag {
  label: string;
  prompt: string;
}

/** Structured Monday morning pastor briefing — sent via Brief button or quick tag. */
export const MONDAY_BRIEF_PROMPT = `Give me my Monday morning pastor briefing for this week. Structure it clearly with these sections:
1. **Needs attention now** — overdue tasks and urgent items
2. **People drifting** — members inactive 30+ days
3. **New visitors** — anyone who visited recently
4. **Celebrations** — birthdays and milestones this week
5. **Prayer & care** — active prayer requests needing follow-up
6. **Giving snapshot** — last 30 days totals
7. **Top 5 to contact** — ranked list with one-line reason each

Keep it scannable, pastoral, and under 400 words. Lead with what matters most today.`;

/** Popular admin CRM prompts — shown in the GRACE side panel. */
export const GRACE_ADMIN_QUICK_TAGS: GraceQuickTag[] = [
  { label: 'Monday Brief', prompt: MONDAY_BRIEF_PROMPT },
  { label: 'Sunday prep', prompt: 'What do I need for Sunday prep this week?' },
  { label: 'Overdue tasks', prompt: 'What tasks are overdue?' },
  { label: 'New visitors', prompt: 'Who visited this week?' },
  { label: 'Needs care', prompt: "Who hasn't attended in 30 days?" },
  { label: 'Giving summary', prompt: 'Summarize giving for the last 30 days' },
];

/** Merge static tags with dynamic suggestion strings; dedupe by label, cap at limit. */
export function mergeQuickTags(
  staticTags: GraceQuickTag[],
  dynamicPrompts: string[],
  limit = 7,
): GraceQuickTag[] {
  const seen = new Set<string>();
  const out: GraceQuickTag[] = [];

  for (const tag of staticTags) {
    const key = tag.label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= limit) return out;
  }

  for (const prompt of dynamicPrompts) {
    const label = prompt.length > 28 ? `${prompt.slice(0, 25)}…` : prompt;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label, prompt });
    if (out.length >= limit) break;
  }

  return out;
}
