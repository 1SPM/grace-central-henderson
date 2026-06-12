/**
 * Crisis detection + priority mapping for portal care conversations.
 *
 * Deliberately conservative keyword matching — false positives are far
 * cheaper than false negatives here (a flagged conversation just gets
 * human attention sooner). The Phase D crisis-escalation agent and the
 * admin Pastoral Care dashboard both key off these flags.
 */

const CRISIS_PATTERNS: RegExp[] = [
  /suicid/i,
  /kill (myself|me)/i,
  /end (my|it all|everything)/i,
  /don'?t want to (live|be here|wake up)/i,
  /self[- ]harm/i,
  /hurt(ing)? myself/i,
  /no reason to live/i,
  /better off without me/i,
  /overdose/i,
  /\babuse(d|ive)?\b/i,
  /domestic violence/i,
];

export function detectCrisis(text: string): boolean {
  return CRISIS_PATTERNS.some((re) => re.test(text));
}

export function priorityForCategory(category: string): 'low' | 'medium' | 'high' | 'crisis' {
  if (category === 'crisis') return 'crisis';
  if (category === 'anxiety-depression' || category === 'addiction') return 'high';
  return 'medium';
}
