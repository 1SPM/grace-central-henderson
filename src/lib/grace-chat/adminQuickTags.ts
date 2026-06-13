export interface GraceQuickTag {
  label: string;
  prompt: string;
}

/** Popular admin CRM prompts — shown in the GRACE side panel. */
export const GRACE_ADMIN_QUICK_TAGS: GraceQuickTag[] = [
  { label: 'Sunday prep', prompt: 'What do I need for Sunday prep this week?' },
  { label: 'Plan sermon', prompt: 'Help me plan a sermon outline' },
  { label: 'Overdue tasks', prompt: 'What tasks are overdue?' },
  { label: 'New visitors', prompt: 'Who visited this week?' },
  { label: 'Needs care', prompt: "Who hasn't attended in 30 days?" },
  { label: 'Giving summary', prompt: 'Summarize giving for the last 30 days' },
];

/** Merge static tags with dynamic suggestion strings; dedupe by label, cap at 6. */
export function mergeQuickTags(
  staticTags: GraceQuickTag[],
  dynamicPrompts: string[],
  limit = 6,
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
