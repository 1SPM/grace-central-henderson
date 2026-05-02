import type { SupabaseClient } from '@supabase/supabase-js';

export interface InboundEmail {
  from_email: string;
  subject: string | null;
  body_text: string | null;
  preview: string | null;
}

export interface PersonContext {
  firstName: string;
  block: string;
}

interface InteractionRow {
  type: string;
  content: string | null;
  created_at: string;
  created_by_name: string | null;
}

interface PrayerRow {
  content: string;
  is_answered: boolean;
  created_at: string;
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Fetches a church's grace_facts text blob (free-form pastor-curated info that
 * Grace can cite when replying — service times, address, parking, etc.) plus
 * the church name for the prompt header. Returns empty string + 'the church'
 * if nothing's set so the caller doesn't have to null-check.
 */
export async function buildChurchContext(
  supabase: SupabaseClient,
  churchId: string,
): Promise<{ name: string; facts: string }> {
  const { data } = await supabase
    .from('churches')
    .select('name, settings')
    .eq('id', churchId)
    .single();
  const facts = (data?.settings as { grace_facts?: string } | null)?.grace_facts || '';
  return { name: data?.name || 'the church', facts };
}

/**
 * Fetches a person + their last 5 interactions + last 3 prayers for use as
 * sender context in a reply prompt. Returns null when there's no person on
 * file so the caller can fall back to the email address.
 */
export async function buildPersonContext(
  supabase: SupabaseClient,
  personId: string,
): Promise<PersonContext | null> {
  const { data: person } = await supabase
    .from('people')
    .select('first_name, last_name, status, first_visit, tags')
    .eq('id', personId)
    .single();
  if (!person) return null;

  const firstName = person.first_name || 'there';
  const lines: string[] = [];

  const tagLine = Array.isArray(person.tags) && person.tags.length > 0
    ? `Tags: ${person.tags.slice(0, 6).join(', ')}.`
    : '';
  const firstVisitLine = person.first_visit ? `First visit: ${person.first_visit}.` : '';
  lines.push(`Sender: ${person.first_name} ${person.last_name} — ${person.status}. ${firstVisitLine} ${tagLine}`.trim());

  const { data: interactions } = await supabase
    .from('interactions')
    .select('type, content, created_at, created_by_name')
    .eq('person_id', personId)
    .order('created_at', { ascending: false })
    .limit(5);
  if (interactions && interactions.length > 0) {
    lines.push('Recent interactions (newest first):');
    for (const i of interactions as InteractionRow[]) {
      const snippet = (i.content || '').replace(/\s+/g, ' ').slice(0, 120);
      const author = i.created_by_name ? ` by ${i.created_by_name}` : '';
      lines.push(`- ${shortDate(i.created_at)} ${i.type}${author}: ${snippet}`);
    }
  }

  const { data: prayers } = await supabase
    .from('prayer_requests')
    .select('content, is_answered, created_at')
    .eq('person_id', personId)
    .order('created_at', { ascending: false })
    .limit(3);
  if (prayers && prayers.length > 0) {
    lines.push('Prayer requests:');
    for (const p of prayers as PrayerRow[]) {
      const status = p.is_answered ? ' (answered)' : '';
      lines.push(`- ${shortDate(p.created_at)}${status}: ${p.content.slice(0, 100)}`);
    }
  }

  return { firstName, block: lines.join('\n') };
}

/**
 * Composes the full reply prompt that Gemini sees, with three labeled sections
 * (CHURCH FACTS / ABOUT THIS SENDER / EMAIL TO REPLY TO) and explicit
 * instructions about citing facts when available, deferring when not, and
 * writing in the church's tone. Used by both the inbound webhook (to generate
 * suggested_reply) and the Mail-tab Draft with Grace endpoint.
 */
export function buildReplyPrompt(args: {
  churchName: string;
  graceFacts: string;
  person: PersonContext | null;
  email: InboundEmail;
  today?: string;
}): { prompt: string; firstName: string } {
  const { churchName, graceFacts, person, email } = args;
  const today = args.today ?? new Date().toISOString().slice(0, 10);
  const firstName = person?.firstName ?? (email.from_email.split('@')[0] || 'there');
  const personSection = person?.block ?? '(No record on file beyond their email address.)';
  const factsSection = graceFacts || '(No church facts on file. If the email asks for specific info, say the pastor will follow up.)';

  const prompt = `You're drafting a reply on behalf of the pastor at ${churchName}.

== CHURCH FACTS (use these freely; cite specific times / addresses / policies when relevant) ==
${factsSection}

== ABOUT THIS SENDER ==
${personSection}

== EMAIL TO REPLY TO ==
Date: ${today}
From: ${email.from_email}
Subject: ${email.subject ?? '(no subject)'}
Body:
${email.body_text ?? email.preview ?? ''}

== INSTRUCTIONS ==
- Warm, plainspoken, brief (2-4 sentences). Match the church tone if the facts mention one.
- Use the church facts to ANSWER specific questions when you can (service times, address, parking, kids' programs). Don't be vague when the answer is right above.
- If the question requires info not in the facts, say the pastor will follow up — don't invent.
- Reference the sender's history naturally if relevant ("good to hear from you again, ${firstName}" if they've been around; "welcome!" if they're a new visitor).
- Sign as "Grace" only — no "Warmly," or other signature lines.
- Single greeting at start: "Hi ${firstName},". No subject line. Output ONLY the reply body.`;

  return { prompt, firstName };
}
